import { Module } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { JobModule } from '../../common/job';
import { RewardsStorageModule } from '../../storage';

@Module({
  imports: [JobModule, RewardsStorageModule],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
