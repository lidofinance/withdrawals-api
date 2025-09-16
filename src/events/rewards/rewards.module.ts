import { Module } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { JobModule } from '../../common/job';
import { ContractConfigStorageModule, RewardsStorageModule } from '../../storage';

@Module({
  imports: [JobModule, RewardsStorageModule, ContractConfigStorageModule],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
