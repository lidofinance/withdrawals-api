import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { RewardEventsService } from './reward-events';
import { WithdrawalEventsService } from './withdrawal-events';

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly rewardsService: RewardEventsService,
    protected readonly withdrawalsService: WithdrawalEventsService,
  ) {}

  public async onModuleInit(): Promise<void> {
    // Do not wait for initialization to avoid blocking the main process
    this.initialize();
  }

  /**
   * Initializes event listeners
   */
  protected async initialize(): Promise<void> {
    await Promise.all([this.rewardsService.initialize(), this.withdrawalsService.initialize()]);
  }
}
