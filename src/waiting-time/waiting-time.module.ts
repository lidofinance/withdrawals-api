import { Module } from '@nestjs/common';

import { WaitingTimeService } from './waiting-time.service';
import {
  ContractConfigStorageModule,
  QueueInfoStorageModule,
  RewardsStorageModule,
  ValidatorsStorageModule,
} from 'storage';
import { GenesisTimeModule } from 'common/genesis-time';
import { RewardsModule } from 'events/rewards';
import { SweepModule } from '../common/sweep';

@Module({
  imports: [
    ValidatorsStorageModule,
    QueueInfoStorageModule,
    ContractConfigStorageModule,
    GenesisTimeModule,
    SweepModule,
    RewardsStorageModule,
    RewardsModule,
  ],
  exports: [WaitingTimeService],
  providers: [WaitingTimeService],
})
export class WaitingTimeModule {}
