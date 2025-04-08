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
import { getValidatorWithdrawalTimestamp } from './utils/get-validator-withdrawal-timestamp';
import { IndexedValidator, ResponseValidatorsData } from '../../common/consensus-provider/consensus-provider.types';
import { SweepService } from '../../common/sweep';

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

    await this.updateValidators();
    const mainJob = new CronJob(cronTime, () => this.updateValidators());
    mainJob.start();

    await this.updateLidoWithdrawableValidators();
    const lidoWithdrawableJob = new CronJob(CronExpression.EVERY_5_MINUTES, () =>
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

        let activeValidatorCount = 0;
        let latestEpoch = `${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`;

        const sweepMeanEpochs = await this.sweepService.getSweepDelayInEpochs(indexedValidators, currentEpoch);
        this.validatorsStorageService.setSweepMeanEpochs(sweepMeanEpochs);

        for (const item of indexedValidators) {
          if (['active_ongoing', 'active_exiting', 'active_slashed'].includes(item.status)) {
            activeValidatorCount++;
          }

          if (item.validator.exit_epoch !== FAR_FUTURE_EPOCH.toString()) {
            if (BigNumber.from(item.validator.exit_epoch).gt(BigNumber.from(latestEpoch))) {
              latestEpoch = item.validator.exit_epoch;
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
        this.validatorsStorageService.setTotalValidatorsCount(indexedValidators.length);
        this.validatorsStorageService.setMaxExitEpoch(latestEpoch);
        await this.findAndSetLidoValidatorsWithdrawableBalances(indexedValidators);
        await this.validatorsCacheService.saveDataToCache();
        this.logAnalyticsAboutWithdrawableBalances(activeValidatorCount, latestEpoch);
        this.validatorsStorageService.setLastUpdate(Math.floor(Date.now() / 1000));
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

    const withdrawableLidoValidatorIds: string[] = [];
    for (const item of lidoValidators) {
      if (item.validator.withdrawable_epoch !== FAR_FUTURE_EPOCH.toString() && BigNumber.from(item.balance).gt(0)) {
        const withdrawalTimestamp = getValidatorWithdrawalTimestamp(
          BigNumber.from(item.index),
          lastWithdrawalValidatorIndex,
          this.validatorsStorageService.getActiveValidatorsCount(),
          this.validatorsStorageService.getTotalValidatorsCount(),
        );
        const frame = this.genesisTimeService.getFrameByTimestamp(withdrawalTimestamp) + 1;
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
        const frameBalances = {};

        for (const validatorId of validatorIds) {
          const stateValidator = await this.consensusProviderService.getStateValidator({
            stateId: 'head',
            validatorId,
          });

          const withdrawalTimestamp = getValidatorWithdrawalTimestamp(
            BigNumber.from(stateValidator.data.index),
            lastWithdrawalValidatorIndex,
            this.validatorsStorageService.getActiveValidatorsCount(),
            this.validatorsStorageService.getTotalValidatorsCount(),
          );
          const frame = this.genesisTimeService.getFrameByTimestamp(withdrawalTimestamp) + 1;
          const prevBalance = frameBalances[frame];
          const balance = parseGwei(stateValidator.data.balance);
          frameBalances[frame] = prevBalance ? prevBalance.add(balance) : BigNumber.from(balance);
        }

        this.validatorsStorageService.setFrameBalances(frameBalances);
        this.logger.log('End update lido withdrawable validators', {
          service: ValidatorsService.SERVICE_LOG_NAME,
          frameBalances: stringifyFrameBalances(frameBalances),
        });
      },
    );
  }

  protected async getLastWithdrawalValidatorIndex() {
    const withdrawals = await this.executionProviderService.getLatestWithdrawals();
    const lastWithdrawal = withdrawals[withdrawals.length - 1];

    this.logger.log('Found last withdrawal', { lastWithdrawal });
    return BigNumber.from(lastWithdrawal ? lastWithdrawal.validatorIndex : 0);
  }

  protected logAnalyticsAboutWithdrawableBalances(activeValidatorCount: number, latestEpoch: string) {
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
    const frameBalances = this.validatorsStorageService.getFrameBalances();
    this.logger.log('End update validators', {
      service: ValidatorsService.SERVICE_LOG_NAME,
      activeValidatorCount,
      latestEpoch,
      frameBalances: stringifyFrameBalances(frameBalances),
      currentFrame,
    });

    Object.keys(frameBalances).forEach((frame) => {
      this.prometheusService.validatorsState
        .labels({
          frame,
          balance: frameBalances[frame].toString(),
        })
        .inc();
    });
  }
}
