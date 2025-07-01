import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { Lido, LIDO_CONTRACT_TOKEN, WITHDRAWAL_QUEUE_CONTRACT_TOKEN, WithdrawalQueue } from '@lido-nestjs/contracts';

import { LOGGER_PROVIDER, LoggerService } from '../../common/logger';
import { ConfigService } from '../../common/config';
import { PrometheusService } from '../../common/prometheus';
import { ExecutionProviderService } from '../../common/execution-provider';
import {
  WithdrawalRequestedEvent,
  WithdrawalsFinalizedEvent,
} from '@lido-nestjs/contracts/dist/generated/WithdrawalQueue';
import { GenesisTimeService } from '../../common/genesis-time';
import { WaitingTimeService } from '../../waiting-time';
import { GAP_AFTER_REPORT } from '../../waiting-time/waiting-time.constants';
import { RewardEventsService } from '../reward-events';
import { WithdrawalRequestInfoEntity } from 'waiting-time/entities/withdrawal-request-info.entity';

@Injectable()
export class WithdrawalEventsService {
  static SERVICE_LOG_NAME = 'withdrawals-events';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly withdrawalQueueContract: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly lidoContract: Lido,
    @InjectRepository(WithdrawalRequestInfoEntity)
    protected readonly withdrawalRequestInfoEntityRepository: Repository<WithdrawalRequestInfoEntity>,
    protected readonly prometheusService: PrometheusService,
    protected readonly configService: ConfigService,
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly executionProvider: ExecutionProviderService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly waitingTimeService: WaitingTimeService,
    protected readonly rewardsService: RewardEventsService,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    if (this.configService.get('IS_SERVICE_UNAVAILABLE')) {
      return;
    }
    this.subscribeWithdrawalRequested();
    this.subscribeWithdrawalsFinalized();

    this.logger.log('Service initialized', { service: WithdrawalEventsService.SERVICE_LOG_NAME });
  }

  subscribeWithdrawalRequested() {
    const withdrawalRequestedEventFilter = this.withdrawalQueueContract.filters.WithdrawalRequested();
    this.provider.on(withdrawalRequestedEventFilter, async (event: WithdrawalRequestedEvent) => {
      try {
        this.logger.log('event WithdrawalRequested triggered', { service: WithdrawalEventsService.SERVICE_LOG_NAME });
        await this.handleWithdrawalRequested(event);
      } catch (error) {
        this.logger.error(`event WithdrawalRequested failed with error ${error}`, {
          service: WithdrawalEventsService.SERVICE_LOG_NAME,
        });
      }
    });
  }

  async handleWithdrawalRequested(event: WithdrawalRequestedEvent) {
    // todo add refslot number or blockNumber
    const blockNumber = event.blockNumber;
    const data = this.withdrawalQueueContract.interface.parseLog(event).args as WithdrawalRequestedEvent['args'];

    const maxExitEpoch = this.waitingTimeService.getMaxExitEpoch();

    const [requestStatus] = await this.withdrawalQueueContract.getWithdrawalStatus([data.requestId]);
    const { timestamp } = requestStatus;
    const requestTimestamp = timestamp.toNumber() * 1000;

    const [unfinalized, buffer, vaultsBalance] = await Promise.all([
      this.withdrawalQueueContract.unfinalizedStETH({ blockTag: blockNumber }),
      this.lidoContract.getBufferedEther({ blockTag: blockNumber }),
      this.rewardsService.getVaultsBalance(blockNumber),
    ]);

    const firstCalculatedFinalization = await this.waitingTimeService.calculateWithdrawalFrame({
      unfinalized,
      buffer,
      vaultsBalance,
      requestTimestamp,
      latestEpoch: maxExitEpoch.toString(),
    });

    const firstCalculatedFinalizationTimestamp = new Date(
      Date.now() +
        this.genesisTimeService.timeToWithdrawalFrame(firstCalculatedFinalization.frame, requestTimestamp) +
        GAP_AFTER_REPORT,
    );

    const wrInfo = this.withdrawalRequestInfoEntityRepository.create({
      requestId: data.requestId.toNumber(),
      requestEpoch: this.genesisTimeService.getEpochByTimestamp(requestTimestamp),
      requestTimestamp: new Date(requestTimestamp),
      amount: data.amountOfStETH.toString(),
      firstCalculatedFinalizationTimestamp,
      firstCalculatedFinalizationType: firstCalculatedFinalization.type,
      minCalculatedFinalizationTimestamp: firstCalculatedFinalizationTimestamp,
      minCalculatedFinalizationType: firstCalculatedFinalization.type,
    });

    // save to db result about first calculate
    await this.withdrawalRequestInfoEntityRepository.save(wrInfo);

    this.logger.log(
      `saved WithdrawalRequestInfo requestId=${
        wrInfo.requestId
      } with predicted finalization at ${firstCalculatedFinalizationTimestamp.toISOString()}`,
      { requestId: wrInfo.requestId, service: WithdrawalEventsService.SERVICE_LOG_NAME },
    );
  }

  subscribeWithdrawalsFinalized() {
    const withdrawalFinalizedEventFilter = this.withdrawalQueueContract.filters.WithdrawalsFinalized();
    this.provider.on(withdrawalFinalizedEventFilter, async (event: WithdrawalsFinalizedEvent) => {
      try {
        this.logger.log('event WithdrawalsFinalized triggered', { service: WithdrawalEventsService.SERVICE_LOG_NAME });
        await this.handleWithdrawalsFinalized(event);
      } catch (error) {
        this.logger.error(`event WithdrawalsFinalized failed with error ${error}`, {
          service: WithdrawalEventsService.SERVICE_LOG_NAME,
        });
      }
    });
  }

  async handleWithdrawalsFinalized(event: WithdrawalsFinalizedEvent) {
    const data = this.withdrawalQueueContract.interface.parseLog(event).args as WithdrawalsFinalizedEvent['args'];
    const finalizedAt = data.timestamp.toNumber() * 1000;

    const withdrawalRequestInfos = await this.withdrawalRequestInfoEntityRepository.find({
      where: { requestId: Between(data.from.toNumber(), data.to.toNumber()) },
    });

    withdrawalRequestInfos.forEach((withdrawalRequestInfo) => {
      withdrawalRequestInfo.finalizedAt = new Date(finalizedAt);
    });

    await this.withdrawalRequestInfoEntityRepository.save(withdrawalRequestInfos);

    for (const withdrawalRequestInfo of withdrawalRequestInfos) {
      const firstRequestFinalizationDiff =
        withdrawalRequestInfo.firstCalculatedFinalizationTimestamp.getTime() - finalizedAt;
      const minRequestFinalizationDiff =
        withdrawalRequestInfo.firstCalculatedFinalizationTimestamp.getTime() - finalizedAt;

      this.prometheusService.firstCalculatedFinalizationDiff
        .labels({ requestId: withdrawalRequestInfo.requestId })
        .set(firstRequestFinalizationDiff);

      this.prometheusService.minCalculatedFinalizationDiff
        .labels({ requestId: withdrawalRequestInfo.requestId })
        .set(minRequestFinalizationDiff);

      this.prometheusService.requestFinalizationAt
        .labels({ requestId: withdrawalRequestInfo.requestId })
        .set(withdrawalRequestInfo.finalizedAt.getTime() / 1000);

      if (firstRequestFinalizationDiff < 0) {
        this.logger.warn(
          `first calculated finalization time is incorrect, id: ${
            withdrawalRequestInfo.requestId
          } first: ${withdrawalRequestInfo.firstCalculatedFinalizationTimestamp.toISOString()}, type: ${
            withdrawalRequestInfo.firstCalculatedFinalizationType
          } , actual: ${new Date(finalizedAt).toISOString()}`,
        );
      }

      if (minRequestFinalizationDiff < 0) {
        this.logger.warn(
          `min calculated finalization time is incorrect, id: ${
            withdrawalRequestInfo.requestId
          } first: ${withdrawalRequestInfo.minCalculatedFinalizationTimestamp.toISOString()}, type: ${
            withdrawalRequestInfo.minCalculatedFinalizationType
          } , actual: ${new Date(finalizedAt).toISOString()}`,
        );
      }
    }
  }
}
