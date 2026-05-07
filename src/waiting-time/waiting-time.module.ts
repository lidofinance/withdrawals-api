import { Module } from '@nestjs/common';

import { WaitingTimeService } from './waiting-time.service';
import { BlockStateCacheService } from './block-state-cache.service';
import {
  ContractConfigStorageModule,
  QueueInfoStorageModule,
  RewardsStorageModule,
  ValidatorsStorageModule,
} from 'storage';
import { GenesisTimeModule } from 'common/genesis-time';
import { RewardsModule } from 'events/rewards';
import { SweepModule } from '../common/sweep';
import { ContractConfigModule } from '../jobs/contract-config';

@Module({
  imports: [
    ValidatorsStorageModule,
    QueueInfoStorageModule,
    ContractConfigStorageModule,
    GenesisTimeModule,
    SweepModule,
    RewardsStorageModule,
    RewardsModule,
    // brings LidoExtensionReader (single instance, shared with the contract-config job)
    ContractConfigModule,
  ],
  exports: [WaitingTimeService],
  providers: [WaitingTimeService, BlockStateCacheService],
})
export class WaitingTimeModule {}
