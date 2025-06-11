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
    const withdrawalRequestedEvent = this.withdrawalQueueContract.filters.WithdrawalRequested();
    this.provider.on(withdrawalRequestedEvent, async (event: WithdrawalRequestedEvent) => {
      this.logger.log('event WithdrawalRequested triggered', { service: WithdrawalEventsService.SERVICE_LOG_NAME });
      await this.handleWithdrawalRequested(event);
    });
  }

  async handleWithdrawalRequested(event: WithdrawalRequestedEvent) {
    const blockNumber = event.blockNumber;
    const data = this.withdrawalQueueContract.interface.parseLog(event).args as WithdrawalRequestedEvent['args'];
    console.log('WithdrawalRequestedEvent requestId', data.requestId.toString(), data);
    // todo: maybe? save to array of all requests instead of cron

    const maxExitEpoch = this.waitingTimeService.getMaxExitEpoch();

    const [requestStatus] = await this.withdrawalQueueContract.getWithdrawalStatus([data.requestId]);
    const { timestamp } = requestStatus;
    const requestTimestamp = timestamp.toNumber() * 1000;

    const [unfinalized, buffer, vaultsBalance] = await Promise.all([
      this.withdrawalQueueContract.unfinalizedStETH({ blockTag: blockNumber }),
      this.lidoContract.getBufferedEther({ blockTag: blockNumber }),
      this.rewardsService.getVaultsBalance(blockNumber),
    ]);

    // todo: fix unfinalized bc it can be more then at request time because few requests may be in one block
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
    });

    // save to db result about first calculate
    await this.withdrawalRequestInfoEntityRepository.save(wrInfo);
  }

  subscribeWithdrawalsFinalized() {
    const withdrawalRequestedEvent = this.withdrawalQueueContract.filters.WithdrawalsFinalized();
    this.provider.on(withdrawalRequestedEvent, async (event: WithdrawalsFinalizedEvent) => {
      this.logger.log('event WithdrawalsFinalized triggered', { service: WithdrawalEventsService.SERVICE_LOG_NAME });
      await this.handleWithdrawalsFinalized(event);
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
      if (withdrawalRequestInfo.firstCalculatedFinalizationTimestamp.getTime() < finalizedAt) {
        this.logger.warn(
          `first calculated finalization time is incorrect, id: ${
            withdrawalRequestInfo.requestId
          } first: ${withdrawalRequestInfo.firstCalculatedFinalizationTimestamp.toISOString()}, type: ${
            withdrawalRequestInfo.firstCalculatedFinalizationType
          } , actual: ${new Date(finalizedAt).toISOString()}`,
        );
      }
    }
  }
}
