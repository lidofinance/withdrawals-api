import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { OneAtTime } from '@lido-nestjs/decorators';
import { CronJob } from 'cron';
import { SpecService } from './spec.service';

@Injectable()
export class SpecJobService implements OnModuleInit {
  static SERVICE_LOG_NAME = 'spec';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly specService: SpecService,
  ) {}

  public async onModuleInit(): Promise<void> {
    const cronTime = '0 0 * * *';
    const job = new CronJob(cronTime, () => this.refreshGlamsterdamForkEpoch());
    job.start();

    this.logger.log('Service initialized', { service: SpecJobService.SERVICE_LOG_NAME, cronTime });

    if (this.specService.hasKnownGlamsterdamForkEpoch()) {
      this.logger.warn('GLOAS_FORK_EPOCH is already known and is not FAR_FUTURE_EPOCH; this job is redundant now', {
        service: SpecJobService.SERVICE_LOG_NAME,
        glamsterdamForkEpoch: this.specService.getGlamsterdamForkEpoch(),
      });
    }
  }

  @OneAtTime()
  protected async refreshGlamsterdamForkEpoch(): Promise<void> {
    await this.specService.refreshGlamsterdamForkEpoch();
  }
}
