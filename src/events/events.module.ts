import { Module } from '@nestjs/common';

import { EventsService } from './events.service';
import { RewardsModule } from './rewards';

@Module({
  imports: [RewardsModule],
  providers: [EventsService],
})
export class EventsModule {}
