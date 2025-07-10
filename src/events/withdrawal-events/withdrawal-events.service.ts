import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class WithdrawalEventsService {
  static SERVICE_LOG_NAME = 'withdrawals-events';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly withdrawalQueueContract: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly lidoContract: Lido,
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

    this.prometheusService.intermediateRequestFinalizationAt
      .labels({ requestId: data.requestId.toString() })
      .set(Math.floor(firstCalculatedFinalizationTimestamp.getTime() / 1000));

    this.prometheusService.firstRequestFinalizationAt
      .labels({ requestId: data.requestId.toString() })
      .set(Math.floor(firstCalculatedFinalizationTimestamp.getTime() / 1000));

    this.logger.debug(
      `saved WithdrawalRequestInfo requestId=${
        data.requestId
      } with predicted finalization at ${firstCalculatedFinalizationTimestamp.toISOString()}`,
      { service: WithdrawalEventsService.SERVICE_LOG_NAME },
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
    const reportId = `report-${data.from}-${data.to}`;

    for (let i = data.from.toNumber(); i < data.to.toNumber(); i++) {
      this.prometheusService.requestFinalizedAt.labels({ requestId: i, reportId }).set(Math.floor(finalizedAt / 1000));
    }
  }
}
