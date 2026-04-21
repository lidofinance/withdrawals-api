import { CronJob } from 'cron';
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { OneAtTime } from '@lido-nestjs/decorators';
import { QueueInfoStorageService } from 'storage';
import { WithdrawalQueue, Lido, WITHDRAWAL_QUEUE_CONTRACT_TOKEN, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { BigNumber } from '@ethersproject/bignumber';
import { WithdrawalRequest } from 'storage/queue-info/queue-info.types';

@Injectable()
export class QueueInfoService {
  protected static readonly WITHDRAWAL_STATUS_PAGE_SIZE = 50;
  private job: CronJob;
  static SERVICE_LOG_NAME = 'queue info';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contractWithdrawal: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,

    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,

    protected readonly queueInfoStorageService: QueueInfoStorageService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    if (this.configService.get('IS_SERVICE_UNAVAILABLE')) {
      return;
    }

    const cronTime = this.configService.get('JOB_INTERVAL_QUEUE_INFO');
    this.job = new CronJob(cronTime, () => this.updateQueueInfo());

    this.job.start();

    try {
      await this.updateQueueInfo();
    } catch (error) {
      this.logger.error(error);
    }

    this.logger.log('Service initialized', { service: QueueInfoService.SERVICE_LOG_NAME, cronTime });
  }

  @OneAtTime()
  protected async updateQueueInfo(): Promise<void> {
    await this.jobService.wrapJob(
      { name: 'update queue info', service: QueueInfoService.SERVICE_LOG_NAME },
      async () => {
        this.logger.log('Start update queue info', { service: QueueInfoService.SERVICE_LOG_NAME });

        const [
          unfinalizedStETH,
          unfinalizedRequests,
          minStethAmount,
          maxStethAmount,
          depositableEther,
          bufferedEther,
          lastRequestId,
        ] = await Promise.all([
          this.contractWithdrawal.unfinalizedStETH(),
          this.contractWithdrawal.unfinalizedRequestNumber(),
          this.contractWithdrawal.MIN_STETH_WITHDRAWAL_AMOUNT(),
          this.contractWithdrawal.MAX_STETH_WITHDRAWAL_AMOUNT(),
          this.contractLido.getDepositableEther(),
          this.contractLido.getBufferedEther(),
          this.contractWithdrawal.getLastRequestId(),
        ]);

        const requests = await this.getUpdatedRequests(lastRequestId, unfinalizedRequests);

        this.queueInfoStorageService.setRequests(requests);
        this.queueInfoStorageService.setStETH(unfinalizedStETH);
        this.queueInfoStorageService.setLastRequestId(lastRequestId);
        this.queueInfoStorageService.setUnfinalizedRequestsCount(unfinalizedRequests);
        this.queueInfoStorageService.setMinStethAmount(minStethAmount);
        this.queueInfoStorageService.setMaxStethAmount(maxStethAmount);
        this.queueInfoStorageService.setDepositableEther(depositableEther);
        this.queueInfoStorageService.setLastUpdate(Math.floor(Date.now() / 1000));
        this.queueInfoStorageService.setNextUpdate(this.getNextUpdateDate());

        this.logger.log('End update queue info', {
          service: QueueInfoService.SERVICE_LOG_NAME,
          requests: requests.length,
          unfinalizedStETH: unfinalizedStETH.toString(),
          lastRequestId: lastRequestId.toString(),
          unfinalizedRequests: unfinalizedRequests.toString(),
          depositableEther: depositableEther.toString(),
          bufferedEther: bufferedEther.toString(),
        });
      },
    );
  }

  protected async getUpdatedRequests(
    lastRequestId: BigNumber,
    unfinalizedRequests: BigNumber,
  ): Promise<WithdrawalRequest[]> {
    const requestIds = this.getRequestIds(lastRequestId, unfinalizedRequests);
    if (requestIds.length === 0) {
      return [];
    }

    const cachedRequests = this.queueInfoStorageService.getRequests();
    const firstExpectedRequestId = requestIds[0];
    const cachedActiveRequests = cachedRequests.filter(
      (request) => request.id.gte(firstExpectedRequestId) && request.id.lte(lastRequestId),
    );

    if (!this.hasContiguousIds(cachedActiveRequests, firstExpectedRequestId)) {
      this.logger.warn('Queue cache is inconsistent, refetching all unfinalized requests', {
        service: QueueInfoService.SERVICE_LOG_NAME,
        cachedRequests: cachedRequests.length,
        cachedActiveRequests: cachedActiveRequests.length,
        unfinalizedRequests: unfinalizedRequests.toString(),
      });
      return await this.fetchRequestsByIds(requestIds);
    }

    const lastCachedRequestId = cachedActiveRequests[cachedActiveRequests.length - 1]?.id;
    const nextRequestId = lastCachedRequestId ? lastCachedRequestId.add(1) : firstExpectedRequestId;
    const nextRequestIndex = nextRequestId.sub(firstExpectedRequestId).toNumber();
    const newRequestIds = requestIds.slice(nextRequestIndex);

    if (newRequestIds.length === 0) {
      return cachedActiveRequests;
    }

    const newRequests = await this.fetchRequestsByIds(newRequestIds);
    return cachedActiveRequests.concat(newRequests);
  }

  protected getRequestIds(lastRequestId: BigNumber, unfinalizedRequests: BigNumber): BigNumber[] {
    if (unfinalizedRequests.eq(0)) {
      return [];
    }

    const firstRequestId = lastRequestId.sub(unfinalizedRequests).add(1);
    return new Array(unfinalizedRequests.toNumber()).fill(true).map((_, i) => firstRequestId.add(i));
  }

  protected hasContiguousIds(requests: WithdrawalRequest[], firstExpectedRequestId: BigNumber): boolean {
    for (let i = 0; i < requests.length; i++) {
      if (!requests[i].id.eq(firstExpectedRequestId.add(i))) {
        return false;
      }
    }

    return true;
  }

  protected async fetchRequestsByIds(requestIds: BigNumber[]): Promise<WithdrawalRequest[]> {
    const requests: WithdrawalRequest[] = [];

    for (let i = 0; i < requestIds.length; i += QueueInfoService.WITHDRAWAL_STATUS_PAGE_SIZE) {
      const requestIdsPage = requestIds.slice(i, i + QueueInfoService.WITHDRAWAL_STATUS_PAGE_SIZE);
      const withdrawalStatuses = await this.contractWithdrawal.getWithdrawalStatus(requestIdsPage);
      requests.push(
        ...withdrawalStatuses.map((w, index) => ({ ...w, id: requestIdsPage[index] } as WithdrawalRequest)),
      );
    }

    return requests;
  }

  protected getNextUpdateDate() {
    const jobNextDate = this.job.nextDate().toJSDate();

    if (!this.job.lastDate()) {
      return jobNextDate;
    }

    const startOfLastJob = this.job.lastDate().getTime();
    const endOfLastJob = new Date().getTime();
    const diff = endOfLastJob - startOfLastJob;

    return new Date(jobNextDate.getTime() + diff);
  }
}
