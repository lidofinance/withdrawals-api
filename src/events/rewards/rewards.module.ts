import { Module } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { JobModule } from '../../common/job';
import { ContractConfigStorageModule, RewardsStorageModule } from '../../storage';
import { GenesisTimeModule } from '../../common/genesis-time';

@Module({
  imports: [JobModule, RewardsStorageModule, ContractConfigStorageModule, GenesisTimeModule],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
