import { Module } from '@nestjs/common';
import { RewardEventsService } from './reward-events.service';
import { JobModule } from '../../common/job';
import { ContractConfigStorageModule, RewardsStorageModule } from '../../storage';

@Module({
  imports: [JobModule, RewardsStorageModule, ContractConfigStorageModule],
  providers: [RewardEventsService],
  exports: [RewardEventsService],
})
export class RewardEventsModule {}
