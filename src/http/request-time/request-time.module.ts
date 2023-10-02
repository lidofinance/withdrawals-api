import { Module } from '@nestjs/common';
import {
  ValidatorsStorageModule,
  QueueInfoStorageModule,
  RewardsStorageModule,
  ContractConfigStorageModule,
} from 'storage';
import { ConfigModule } from 'common/config';
import { GenesisTimeModule } from 'common/genesis-time';
import { RequestTimeController } from './request-time.controller';
import { RequestTimeService } from './request-time.service';
import { BunkerModule } from './bunker/bunker.module';

@Module({
  imports: [
    ValidatorsStorageModule,
    QueueInfoStorageModule,
    ContractConfigStorageModule,
    ConfigModule,
    GenesisTimeModule,
    RewardsStorageModule,
    BunkerModule,
  ],
  controllers: [RequestTimeController],
  providers: [RequestTimeService],
})
export class RequestTimeModule {}
