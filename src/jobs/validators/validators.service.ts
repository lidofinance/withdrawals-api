import { CronJob } from 'cron';
import { Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { FAR_FUTURE_EPOCH } from 'common/constants';
import { ConsensusProviderService } from 'common/consensus-provider';
import { ConsensusClientService } from 'common/consensus-provider/consensus-client.service';
import { GenesisTimeService, SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';
import { OneAtTime } from '@lido-nestjs/decorators';
import { ValidatorsStorageService } from 'storage';
import { ORACLE_REPORTS_CRON_BY_CHAIN_ID, MAX_SEED_LOOKAHEAD } from './validators.constants';
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
import { hasCompoundingWithdrawalCredential, hasEth1WithdrawalCredential } from './utils/validator-state-utils';
import { IndexedValidator, ResponseValidatorsData } from '../../common/consensus-provider/consensus-provider.types';
import { SweepService, WithdrawalSweepState } from '../../common/sweep';
import { toEth } from '../../common/utils/to-eth';
import { getChurnLimit } from './utils/get-churn-limit';

type WithdrawalSweepStateCaller = 'updateValidators' | 'updateLidoWithdrawableValidators';

const GET_STATE_VALIDATORS_MAX_ATTEMPTS = 3;
const GET_STATE_VALIDATORS_RETRY_DELAY_MS = 10_000;

export class ValidatorsService {
  static SERVICE_LOG_NAME = 'validators';
  private cronJobs: CronJob[] = [];
  private validatorUpdateCronTimes: string[] = [];
  protected static readonly UPDATE_DELAY_MS = 30 * 60 * 1000;
  private withdrawalSweepStateCallCount = 0;
  private activeWithdrawalSweepStateCalls = new Map<number, WithdrawalSweepStateCaller>();
  private withdrawalSweepStateCallCountByCaller: Record<WithdrawalSweepStateCaller, number> = {
    updateValidators: 0,
    updateLidoWithdrawableValidators: 0,
  };

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly prometheusService: PrometheusService,
    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly consensusClientService: ConsensusClientService,
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
    const cronTimes = envCronTime ? [envCronTime] : Array.isArray(cronByChainId) ? cronByChainId : [cronByChainId];
    this.validatorUpdateCronTimes = cronTimes;

    try {
      await this.updateValidators();
    } catch (error) {
      this.logger.error(error);
    }

    this.cronJobs = cronTimes.map((cronTime) => {
      const cronJob = new CronJob(cronTime, () => this.updateValidators());
      cronJob.start();

      return cronJob;
    });

    try {
      await this.updateLidoWithdrawableValidators();
    } catch (error) {
      this.logger.error(error);
    }

    const lidoWithdrawableJob = new CronJob(CronExpression.EVERY_30_MINUTES, () =>
      this.updateLidoWithdrawableValidators(),
    );
    lidoWithdrawableJob.start();

    this.logger.log('Service initialized', { service: ValidatorsService.SERVICE_LOG_NAME, cronTime: cronTimes });
  }

  public rescheduleCronJobs(newInitialEpoch: number, newEpochsPerFrame: number) {
    const cronTimes = this.buildCron(newInitialEpoch, newEpochsPerFrame);

    if (cronTimes.length === 0) {
      this.logger.log('Skip validators cron reschedule because  nothing to schedule', {
        service: ValidatorsService.SERVICE_LOG_NAME,
        cronTimes,
      });
      return;
    }

    if (
      this.validatorUpdateCronTimes.length === cronTimes.length &&
      this.validatorUpdateCronTimes.every((cronTime, index) => cronTime === cronTimes[index])
    ) {
      this.logger.log('Skip validators cron reschedule because cron times did not change', {
        service: ValidatorsService.SERVICE_LOG_NAME,
        cronTimes,
      });
      return;
    }

    this.cronJobs.forEach((cronJob) => {
      cronJob.stop();
    });

    this.validatorUpdateCronTimes = cronTimes;
    this.cronJobs = cronTimes.map((cronTime) => {
      const cronJob = new CronJob(cronTime, () => this.updateValidators());
      cronJob.start();

      return cronJob;
    });
  }

  @OneAtTime()
  protected async updateValidators(): Promise<void> {
    await this.jobService.wrapJob(
      { name: 'update validators', service: ValidatorsService.SERVICE_LOG_NAME },
      async () => {
        this.logger.log('Start update validators', { service: ValidatorsService.SERVICE_LOG_NAME });

        const indexedValidators = await this.getStateValidatorsWithRetry('head');
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
        this.validatorsStorageService.setLastUpdate(Math.floor(Date.now() / 1000));
        await this.validatorsCacheService.saveDataToCache();

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

    const frameBalances = {};
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();
    const totalValidatorsCount = this.validatorsStorageService.getTotalValidatorsCount();
    const activeValidatorCount = this.validatorsStorageService.getActiveValidatorsCount();
    const now = Date.now();
    const withdrawalSweepState = await this.getWithdrawalSweepState('updateValidators');

    const withdrawableLidoValidatorIds: string[] = [];
    for (const item of lidoValidators) {
      if (item.validator.withdrawable_epoch !== FAR_FUTURE_EPOCH.toString() && BigNumber.from(item.balance).gt(0)) {
        const withdrawableEpoch = +item.validator.withdrawable_epoch.toString();
        const estimatedWithdrawalTimestamp = getValidatorWithdrawalTimestamp({
          validatorIndex: BigNumber.from(item.index),
          sweepCursorValidatorIndex: withdrawalSweepState.sweepCursorValidatorIndex,
          totalValidatorsCount,
          activeValidatorCount,
          currentEpoch,
          withdrawableEpoch,
          blockedByDeferredSlots: withdrawalSweepState.blockedByDeferredSlots,
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

        try {
          const validatorIds = this.validatorsStorageService.getWithdrawableLidoValidatorIds();
          const totalValidatorsCount = this.validatorsStorageService.getTotalValidatorsCount();
          const activeValidatorCount = this.validatorsStorageService.getActiveValidatorsCount();
          const currentEpoch = this.genesisTimeService.getCurrentEpoch();
          const now = Date.now();
          const frameBalances = {};
          const withdrawalSweepState = await this.getWithdrawalSweepState('updateLidoWithdrawableValidators');

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
              const estimatedWithdrawalTimestamp = getValidatorWithdrawalTimestamp({
                validatorIndex: BigNumber.from(stateValidator.index),
                totalValidatorsCount,
                activeValidatorCount,
                sweepCursorValidatorIndex: withdrawalSweepState.sweepCursorValidatorIndex,
                currentEpoch,
                withdrawableEpoch,
                blockedByDeferredSlots: withdrawalSweepState.blockedByDeferredSlots,
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
        } catch (error) {
          this.logger.error('Failed to process validators batch', {
            service: ValidatorsService.SERVICE_LOG_NAME,
            error,
          });

          throw error;
        }
      },
    );
  }

  protected async getStateValidatorsWithRetry(stateId: string): Promise<ResponseValidatorsData> {
    for (let attempt = 1; attempt <= GET_STATE_VALIDATORS_MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now();

      this.logger.debug('[getStateValidatorsStream] attempt started', {
        service: ValidatorsService.SERVICE_LOG_NAME,
        stateId,
        attempt,
        maxAttempts: GET_STATE_VALIDATORS_MAX_ATTEMPTS,
      });

      try {
        const stream = await this.consensusProviderService.getStateValidatorsStream({ stateId });
        const indexedValidators: ResponseValidatorsData = await processValidatorsStream(stream);

        this.logger.log('[getStateValidatorsStream] attempt completed', {
          service: ValidatorsService.SERVICE_LOG_NAME,
          stateId,
          attempt,
          maxAttempts: GET_STATE_VALIDATORS_MAX_ATTEMPTS,
          durationMs: Date.now() - startedAt,
          validatorsCount: indexedValidators.length,
        });

        return indexedValidators;
      } catch (error) {
        const durationMs = Date.now() - startedAt;

        this.logger.warn('[getStateValidatorsStream] attempt failed', {
          service: ValidatorsService.SERVICE_LOG_NAME,
          stateId,
          attempt,
          maxAttempts: GET_STATE_VALIDATORS_MAX_ATTEMPTS,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt === GET_STATE_VALIDATORS_MAX_ATTEMPTS) {
          throw error;
        }

        const retryDelayMs = GET_STATE_VALIDATORS_RETRY_DELAY_MS * attempt;

        this.logger.warn('[getStateValidatorsStream] retrying', {
          service: ValidatorsService.SERVICE_LOG_NAME,
          stateId,
          attempt,
          nextAttempt: attempt + 1,
          retryDelayMs,
        });

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    throw new Error('Unreachable');
  }

  protected async getWithdrawalSweepState(
    caller: WithdrawalSweepStateCaller,
    stateId = 'head',
  ): Promise<WithdrawalSweepState> {
    const callId = ++this.withdrawalSweepStateCallCount;
    const callerCallCount = ++this.withdrawalSweepStateCallCountByCaller[caller];
    const startedAt = Date.now();
    const parallelWith = Array.from(this.activeWithdrawalSweepStateCalls.entries()).map(
      ([activeCallId, activeCaller]) => ({
        callId: activeCallId,
        caller: activeCaller,
      }),
    );

    this.activeWithdrawalSweepStateCalls.set(callId, caller);

    this.logger.log('[getWithdrawalSweepState] started', {
      service: ValidatorsService.SERVICE_LOG_NAME,
      caller,
      callId,
      callerCallCount,
      totalCallCount: this.withdrawalSweepStateCallCount,
      stateId,
      activeCalls: this.activeWithdrawalSweepStateCalls.size,
      isParallel: parallelWith.length > 0,
      parallelWith,
    });

    try {
      const state = await this.consensusClientService.getStateSweepData(stateId);
      const nextWithdrawalValidatorIndex = state.next_withdrawal_validator_index;

      if (nextWithdrawalValidatorIndex === undefined) {
        throw new Error(`Consensus state ${stateId} is missing next_withdrawal_validator_index`);
      }

      const blockedByDeferredSlots =
        state.latest_full_slot !== undefined
          ? Math.max(0, BigNumber.from(state.slot).sub(BigNumber.from(state.latest_full_slot)).toNumber())
          : 0;
      const hasDeferredWithdrawals = blockedByDeferredSlots > 0;

      const sweepState: WithdrawalSweepState = {
        sweepCursorValidatorIndex: BigNumber.from(nextWithdrawalValidatorIndex),
        hasDeferredWithdrawals,
        blockedByDeferredSlots,
        stateSlot: state.slot,
        latestFullSlot: state.latest_full_slot,
        source: 'consensus',
      };

      this.logger.log('[getWithdrawalSweepState] completed', {
        service: ValidatorsService.SERVICE_LOG_NAME,
        caller,
        callId,
        callerCallCount,
        totalCallCount: this.withdrawalSweepStateCallCount,
        stateId,
        durationMs: Date.now() - startedAt,
        isParallel: parallelWith.length > 0,
        parallelWith,
        sweepCursorValidatorIndex: sweepState.sweepCursorValidatorIndex.toString(),
        hasDeferredWithdrawals: sweepState.hasDeferredWithdrawals,
        blockedByDeferredSlots: sweepState.blockedByDeferredSlots,
        stateSlot: sweepState.stateSlot,
        latestFullSlot: sweepState.latestFullSlot,
      });

      return sweepState;
    } catch (error) {
      this.logger.error(
        `[getWithdrawalSweepState] failed caller=${caller} callId=${callId} callerCallCount=${callerCallCount} durationMs=${
          Date.now() - startedAt
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    } finally {
      this.activeWithdrawalSweepStateCalls.delete(callId);

      this.logger.debug('[getWithdrawalSweepState] finished', {
        service: ValidatorsService.SERVICE_LOG_NAME,
        caller,
        callId,
        callerCallCount,
        totalCallCount: this.withdrawalSweepStateCallCount,
        activeCalls: this.activeWithdrawalSweepStateCalls.size,
      });
    }
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

  // example: newInitialEpoch=91799, newEpochsPerFrame=45
  // 45 * 32 * 12 / 3600 = 4.8 hours each frame (5 times per day)
  public buildCron(newInitialEpoch: number, newEpochsPerFrame: number) {
    const firstDate = this.genesisTimeService.getTimestampByEpoch(newInitialEpoch);
    const eachSec = newEpochsPerFrame * SLOTS_PER_EPOCH * SECONDS_PER_SLOT;
    const secondsPerDay = 24 * 60 * 60;

    if (secondsPerDay % eachSec !== 0) {
      this.logger.warn('VEBO frame duration does not fit a simple daily cron schedule', {
        service: ValidatorsService.SERVICE_LOG_NAME,
        newInitialEpoch,
        newEpochsPerFrame,
        eachSec,
      });
      return [];
    }

    const firstRunAt = new Date(firstDate + ValidatorsService.UPDATE_DELAY_MS);
    const firstRunAtSecondOfDay =
      firstRunAt.getUTCHours() * 3600 + firstRunAt.getUTCMinutes() * 60 + firstRunAt.getUTCSeconds();
    const runsPerDay = secondsPerDay / eachSec;

    const cronEntries = Array.from({ length: runsPerDay }, (_, index) => {
      const runAtSecondOfDay = (firstRunAtSecondOfDay + index * eachSec) % secondsPerDay;
      const hours = Math.floor(runAtSecondOfDay / 3600);
      const minutes = Math.floor((runAtSecondOfDay % 3600) / 60);

      return {
        sortKey: runAtSecondOfDay,
        cron: `${minutes} ${hours} * * *`,
      };
    });

    return cronEntries.sort((left, right) => left.sortKey - right.sortKey).map((entry) => entry.cron);
  }
}
