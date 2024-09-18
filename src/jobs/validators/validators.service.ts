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
import { unblock } from '../../common/utils/unblock';
import { LidoKeysService } from './lido-keys';
import { ResponseValidatorsData, Validator } from './validators.types';
import { parseGweiToWei } from '../../common/utils/parse-gwei-to-big-number';
import { ValidatorsCacheService } from 'storage/validators/validators-cache.service';
import { CronExpression } from '@nestjs/schedule';
import { PrometheusService } from '../../common/prometheus';
import { stringifyFrameBalances } from '../../common/validators/strigify-frame-balances';
import { getValidatorWithdrawalTimestamp } from './utils/get-validator-withdrawal-timestamp';

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
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    await this.validatorsCacheService.initializeFromCache();
    await this.updateValidators();

    const envCronTime = this.configService.get('JOB_INTERVAL_VALIDATORS');
    const chainId = this.configService.get('CHAIN_ID');
    const cronByChainId = ORACLE_REPORTS_CRON_BY_CHAIN_ID[chainId] ?? CronExpression.EVERY_3_HOURS;
    const cronTime = envCronTime ? envCronTime : cronByChainId;
    const job = new CronJob(cronTime, () => this.updateValidators());
    job.start();

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
        const data: ResponseValidatorsData = await processValidatorsStream(stream);
        const currentEpoch = this.genesisTimeService.getCurrentEpoch();

        let activeValidatorCount = 0;
        let latestEpoch = `${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`;

        for (const item of data) {
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

        this.validatorsStorageService.setActiveValidatorsCount(activeValidatorCount);
        this.validatorsStorageService.setTotalValidatorsCount(data.length);
        this.validatorsStorageService.setMaxExitEpoch(latestEpoch);
        this.validatorsStorageService.setLastUpdate(Math.floor(Date.now() / 1000));

        const frameBalances = await this.getLidoValidatorsWithdrawableBalances(data);
        this.validatorsStorageService.setFrameBalances(frameBalances);
        await this.validatorsCacheService.saveDataToCache();

        const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
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
              balance: frameBalances[frame],
            })
            .inc();
        });
      },
    );
  }

  protected async getLidoValidatorsWithdrawableBalances(validators: Validator[]) {
    const keysData = await this.lidoKeys.fetchLidoKeysData();
    const lidoValidators = await this.lidoKeys.getLidoValidatorsByKeys(keysData.data, validators);
    const lastWithdrawalValidatorIndex = await this.getLastWithdrawalValidatorIndex();
    const frameBalances = {};

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
        const balance = parseGweiToWei(item.balance);
        frameBalances[frame] = prevBalance ? prevBalance.add(balance) : BigNumber.from(balance);
      }

      await unblock();
    }

    return frameBalances;
  }

  protected async getLastWithdrawalValidatorIndex() {
    const withdrawals = await this.executionProviderService.getLatestWithdrawals();
    return BigNumber.from(withdrawals[withdrawals.length - 1].validatorIndex);
  }
}
