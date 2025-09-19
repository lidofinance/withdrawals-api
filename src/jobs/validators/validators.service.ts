import { CronJob } from 'cron';
import { Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { ConsensusProviderService } from 'common/consensus-provider';
import { ExecutionProviderService } from 'common/execution-provider';
import { GenesisTimeService } from 'common/genesis-time';
import { OneAtTime } from '@lido-nestjs/decorators';
import { ValidatorsStorageService } from 'storage';
import { FAR_FUTURE_EPOCH, ORACLE_REPORTS_CRON_BY_CHAIN_ID, MAX_SEED_LOOKAHEAD } from './validators.constants';
import { BigNumber } from '@ethersproject/bignumber';
import { processValidatorsStream } from 'jobs/validators/utils/validators-stream';
import { unblock } from 'common/utils/unblock';
import { LidoKeysService } from './lido-keys';
import { parseGwei } from 'common/utils/parse-gwei';
import { ValidatorsCacheService } from 'storage/validators/validators-cache.service';
import { CronExpression } from '@nestjs/schedule';
import { PrometheusService } from 'common/prometheus';
import { stringifyFrameBalances } from 'common/validators/strigify-frame-balances';
import { getValidatorWithdrawalTimestampV2 } from './utils/get-validator-withdrawal-timestamp';
import { IndexedValidator, ResponseValidatorsData } from '../../common/consensus-provider/consensus-provider.types';
import { SweepService } from '../../common/sweep';
import { toEth } from '../../common/utils/to-eth';
import { getChurnLimit } from './utils/get-churn-limit';

export class ValidatorsService {
  static SERVICE_LOG_NAME = 'validators';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly prometheusService: PrometheusService,
    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly executionProviderService: ExecutionProviderService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
    protected readonly validatorsStorageService: ValidatorsStorageService,
    protected readonly validatorsCacheService: ValidatorsCacheService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly lidoKeys: LidoKeysService,
    protected readonly sweepService: SweepService,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    if (this.configService.get('IS_SERVICE_UNAVAILABLE')) {
      return;
    }

    await this.validatorsCacheService.initializeFromCache();

    const envCronTime = this.configService.get('JOB_INTERVAL_VALIDATORS');
    const chainId = this.configService.get('CHAIN_ID');
    const cronByChainId = ORACLE_REPORTS_CRON_BY_CHAIN_ID[chainId] ?? CronExpression.EVERY_3_HOURS;
    const cronTime = envCronTime ? envCronTime : cronByChainId;

    try {
      await this.updateValidators();
    } catch (error) {
      this.logger.error(error);
    }
    const mainJob = new CronJob(cronTime, () => this.updateValidators());
    mainJob.start();

    try {
      await this.updateLidoWithdrawableValidators();
    } catch (error) {
      this.logger.error(error);
    }

    const lidoWithdrawableJob = new CronJob(CronExpression.EVERY_30_MINUTES, () =>
      this.updateLidoWithdrawableValidators(),
    );
    lidoWithdrawableJob.start();

    this.logger.log('Service initialized', { service: ValidatorsService.SERVICE_LOG_NAME, cronTime });
  }

  @OneAtTime()
  protected async updateValidators(): Promise<void> {
    await this.jobService.wrapJob(
      { name: 'update validators', service: ValidatorsService.SERVICE_LOG_NAME },
      async () => {
        this.logger.log('Start update validators', { service: ValidatorsService.SERVICE_LOG_NAME });

        const stream = await this.consensusProviderService.getStateValidatorsStream({
          stateId: 'head',
        });
        const indexedValidators: ResponseValidatorsData = await processValidatorsStream(stream);
        const currentEpoch = this.genesisTimeService.getCurrentEpoch();

        const sweepMeanEpochs = await this.sweepService.getSweepDelayInEpochs(indexedValidators, currentEpoch);
        this.validatorsStorageService.setSweepMeanEpochs(sweepMeanEpochs);

        let activeValidatorCount = 0;
        let maxExitEpoch = `${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`;
        let totalActiveBalance = BigNumber.from(0);

        for (const item of indexedValidators) {
          if (['active_ongoing', 'active_exiting', 'active_slashed'].includes(item.status)) {
            activeValidatorCount++;
            totalActiveBalance = totalActiveBalance.add(item.balance);
          }

          if (item.validator.exit_epoch !== FAR_FUTURE_EPOCH.toString()) {
            if (BigNumber.from(item.validator.exit_epoch).gt(BigNumber.from(maxExitEpoch))) {
              maxExitEpoch = item.validator.exit_epoch;
            }
          }

          await unblock();
        }

        this.logger.debug(
          'found validators',
          {
            indexedValidatorsCount: indexedValidators.length,
            activeValidatorsCount: activeValidatorCount,
            service: ValidatorsService.SERVICE_LOG_NAME,
          },
          {},
        );

        this.validatorsStorageService.setActiveValidatorsCount(activeValidatorCount);
        this.validatorsStorageService.setChurnLimit(getChurnLimit(totalActiveBalance).toNumber());
        this.validatorsStorageService.setTotalValidatorsCount(indexedValidators.length);
        this.validatorsStorageService.setMaxExitEpoch(maxExitEpoch);
        await this.findAndSetLidoValidatorsWithdrawableBalances(indexedValidators);
        await this.validatorsCacheService.saveDataToCache();
        this.validatorsStorageService.setLastUpdate(Math.floor(Date.now() / 1000));

        this.logAnalyticsAboutFrameBalances();

        const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
        const frameBalances = this.validatorsStorageService.getFrameBalances();
        this.logger.log('End update validators', {
          service: ValidatorsService.SERVICE_LOG_NAME,
          activeValidatorCount,
          maxExitEpoch,
          frameBalances: frameBalances ? stringifyFrameBalances(frameBalances) : null,
          currentFrame,
        });
      },
    );
  }

  protected async findAndSetLidoValidatorsWithdrawableBalances(validators: IndexedValidator[]) {
    const keysData = await this.lidoKeys.fetchLidoKeysData();
    this.logger.debug('fetchLidoKeysData', {
      keysDataLength: keysData.data.length,
      service: ValidatorsService.SERVICE_LOG_NAME,
    });
    const lidoValidators = await this.lidoKeys.getLidoValidatorsByKeys(keysData.data, validators);
    this.logger.debug('lidoValidators', {
      lidoValidatorsLength: lidoValidators.length,
      service: ValidatorsService.SERVICE_LOG_NAME,
    });
    const lastWithdrawalValidatorIndex = await this.getLastWithdrawalValidatorIndex();
    this.logger.debug('lastWithdrawalValidatorIndex', {
      lastWithdrawalValidatorIndex,
      service: ValidatorsService.SERVICE_LOG_NAME,
    });
    const frameBalances = {};
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();
    const totalValidatorsCount = this.validatorsStorageService.getTotalValidatorsCount();
    const activeValidatorCount = this.validatorsStorageService.getActiveValidatorsCount();
    const now = Date.now();

    const withdrawableLidoValidatorIds: string[] = [];
    for (const item of lidoValidators) {
      if (item.validator.withdrawable_epoch !== FAR_FUTURE_EPOCH.toString() && BigNumber.from(item.balance).gt(0)) {
        const withdrawableEpoch = +item.validator.withdrawable_epoch.toString();
        const estimatedWithdrawalTimestamp = getValidatorWithdrawalTimestampV2({
          validatorIndex: BigNumber.from(item.index),
          lastWithdrawalValidatorIndex,
          totalValidatorsCount,
          activeValidatorCount,
          currentEpoch,
          withdrawableEpoch,
          nowMs: now,
        });
        const frame = this.genesisTimeService.getFrameByTimestamp(estimatedWithdrawalTimestamp) + 1;
        const prevBalance = frameBalances[frame];
        const balance = parseGwei(item.balance);
        frameBalances[frame] = prevBalance ? prevBalance.add(balance) : BigNumber.from(balance);
        withdrawableLidoValidatorIds.push(item.index);
      }

      await unblock();
    }

    this.validatorsStorageService.setFrameBalances(frameBalances);
    this.validatorsStorageService.setWithdrawableLidoValidatorIds(withdrawableLidoValidatorIds);
  }

  // updates withdrawable lido validators based on previously identified IDs
  @OneAtTime()
  protected async updateLidoWithdrawableValidators() {
    await this.jobService.wrapJob(
      { name: 'update lido withdrawable validators', service: ValidatorsService.SERVICE_LOG_NAME },
      async () => {
        this.logger.log('Start update lido withdrawable validators', { service: ValidatorsService.SERVICE_LOG_NAME });

        const validatorIds = this.validatorsStorageService.getWithdrawableLidoValidatorIds();
        const lastWithdrawalValidatorIndex = await this.getLastWithdrawalValidatorIndex();
        const totalValidatorsCount = this.validatorsStorageService.getTotalValidatorsCount();
        const activeValidatorCount = this.validatorsStorageService.getActiveValidatorsCount();
        const currentEpoch = this.genesisTimeService.getCurrentEpoch();
        const now = Date.now();
        const frameBalances = {};

        const batchSize = 20;
        for (let i = 0; i < validatorIds.length; i += batchSize) {
          const batch = validatorIds.slice(i, i + batchSize);

          const stateValidators = await this.consensusProviderService.getStateValidators({
            stateId: 'head',
            id: batch,
          });

          for (let j = 0; j < batch.length; j++) {
            const stateValidator = stateValidators.data[j];

            const withdrawableEpoch = +stateValidator.validator.withdrawable_epoch.toString();
            const estimatedWithdrawalTimestamp = getValidatorWithdrawalTimestampV2({
              validatorIndex: BigNumber.from(stateValidator.index),
              totalValidatorsCount,
              activeValidatorCount,
              lastWithdrawalValidatorIndex,
              currentEpoch,
              withdrawableEpoch,
              nowMs: now,
            });

            const frame = this.genesisTimeService.getFrameByTimestamp(estimatedWithdrawalTimestamp) + 1;
            const prevBalance = frameBalances[frame];
            const balance = parseGwei(stateValidator.balance);
            frameBalances[frame] = prevBalance ? prevBalance.add(balance) : BigNumber.from(balance);
          }
        }

        this.validatorsStorageService.setFrameBalances(frameBalances);
        this.logger.log('End update lido withdrawable validators', {
          service: ValidatorsService.SERVICE_LOG_NAME,
          frameBalances: stringifyFrameBalances(frameBalances),
        });
        this.logAnalyticsAboutFrameBalances();
      },
    );
  }

  protected async getLastWithdrawalValidatorIndex() {
    const withdrawals = await this.executionProviderService.getLatestWithdrawals();
    const lastWithdrawal = withdrawals[withdrawals.length - 1];

    this.logger.log('Found last withdrawal', { lastWithdrawal });
    return BigNumber.from(lastWithdrawal ? lastWithdrawal.validatorIndex : 0);
  }

  protected logAnalyticsAboutFrameBalances() {
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
    const frameBalances = this.validatorsStorageService.getFrameBalances();

    const someFrame = Object.keys(frameBalances).some((frame) => {
      return +frame < currentFrame;
    });

    if (someFrame) {
      this.logger.warn('frameBalances contains frames in past', {
        frameBalances: stringifyFrameBalances(frameBalances),
        currentFrame,
      });
    }

    const sum = Object.keys(frameBalances).reduce((acc, item) => {
      return acc.add(frameBalances[item]);
    }, BigNumber.from(0));

    this.prometheusService.sumValidatorsBalances.set(toEth(sum).toNumber());
  }
}
