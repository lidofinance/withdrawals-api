import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { RewardsService } from './rewards';

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly rewardsService: RewardsService,
  ) {}

  public async onModuleInit(): Promise<void> {
    // Do not wait for initialization to avoid blocking the main process
    this.initialize();
  }

  /**
   * Initializes event listeners
   */
  protected async initialize(): Promise<void> {
    await Promise.all([this.rewardsService.initialize()]);
  }
}
