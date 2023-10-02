import { Module } from '@nestjs/common';
import { RewardsStorageService } from './rewards.service';

@Module({
  providers: [RewardsStorageService],
  exports: [RewardsStorageService],
})
export class RewardsStorageModule {}
