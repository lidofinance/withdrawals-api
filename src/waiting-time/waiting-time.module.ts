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

@Module({
  imports: [
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
