import { Module } from '@nestjs/common';

import { EventsService } from './events.service';
import { RewardEventsModule } from './reward-events';
import { WithdrawalEventsModule } from './withdrawal-events';

@Module({
  imports: [RewardEventsModule, WithdrawalEventsModule],
  providers: [EventsService],
})
export class EventsModule {}
