import { CronJob } from 'cron';
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { OneAtTime } from '@lido-nestjs/decorators';
import { GenesisTimeService } from '../../common/genesis-time';

@Injectable()
export class SpecJobService {
  static SERVICE_LOG_NAME = 'spec';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
    protected readonly genesisTimeService: GenesisTimeService,
  ) {}

  public async initialize(): Promise<void> {
    if (this.configService.get('IS_SERVICE_UNAVAILABLE')) {
      return;
    }

    const cronTime = '0 0 * * *';
    const job = new CronJob(cronTime, () => this.refreshGlamsterdamForkEpoch());
    job.start();

    this.logger.log('Service initialized', { service: SpecJobService.SERVICE_LOG_NAME, cronTime });
  }

  @OneAtTime()
  protected async refreshGlamsterdamForkEpoch(): Promise<void> {
    await this.jobService.wrapJob(
      { name: 'refresh glamsterdam fork epoch', service: SpecJobService.SERVICE_LOG_NAME },
      async () => {
        await this.genesisTimeService.refreshGlamsterdamForkEpoch();
      },
    );
  }
}
