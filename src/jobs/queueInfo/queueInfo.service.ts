import { CronJob } from 'cron';
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { OneAtTime } from '@lido-nestjs/decorators';
import { QueueInfoStorageService } from 'storage';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';

@Injectable()
export class QueueInfoService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,

    protected readonly queueInfoStorageService: QueueInfoStorageService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    const isDisableJob = this.configService.get('DISABLE_V2');
    if (isDisableJob) {
      this.logger.log('Service disabled', { service: 'queue info' });
      return;
    }

    await this.updateQueueInfo();

    const cronTime = this.configService.get('JOB_INTERVAL_QUEUE_INFO');
    const job = new CronJob(cronTime, () => this.updateQueueInfo());
    job.start();

    this.logger.log('Service initialized', { service: 'queue info', cronTime });
  }

  @OneAtTime()
  protected async updateQueueInfo(): Promise<void> {
    await this.jobService.wrapJob({ name: 'update queue info' }, async () => {
      const [unfinalizedStETH, unfinalizedRequests, minStethAmount, maxStethAmount] = await Promise.all([
        this.contract.unfinalizedStETH(),
        this.contract.unfinalizedRequestNumber(),
        this.contract.MIN_STETH_WITHDRAWAL_AMOUNT(),
        this.contract.MAX_STETH_WITHDRAWAL_AMOUNT(),
      ]);
      this.queueInfoStorageService.setStETH(unfinalizedStETH);
      this.queueInfoStorageService.setRequests(unfinalizedRequests);
      this.queueInfoStorageService.setLastUpdate(Math.floor(Date.now() / 1000));
      this.queueInfoStorageService.setMinStethAmount(minStethAmount);
      this.queueInfoStorageService.setMaxStethAmount(maxStethAmount);
    });
  }
}
