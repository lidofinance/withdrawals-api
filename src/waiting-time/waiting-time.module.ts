import { Module } from '@nestjs/common';

import { WaitingTimeService } from './waiting-time.service';
import {
  ContractConfigStorageModule,
  QueueInfoStorageModule,
  RewardsStorageModule,
  ValidatorsStorageModule,
} from 'storage';
import { GenesisTimeModule } from 'common/genesis-time';
import { RewardEventsModule } from 'events/reward-events';
import { SweepModule } from '../common/sweep';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawalRequestInfoEntity } from './entities/withdrawal-request-info.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WithdrawalRequestInfoEntity]),
    ValidatorsStorageModule,
    QueueInfoStorageModule,
    ContractConfigStorageModule,
    GenesisTimeModule,
    SweepModule,
    RewardsStorageModule,
    RewardEventsModule,
  ],
  exports: [WaitingTimeService],
  providers: [WaitingTimeService],
})
export class WaitingTimeModule {}
