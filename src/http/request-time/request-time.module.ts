import { Module } from '@nestjs/common';
import { ValidatorsStorageModule, QueueInfoStorageModule } from 'storage';
import { ConfigModule } from 'common/config';
import { GenesisTimeModule } from 'common/genesis-time';
import { RequestTimeController } from './request-time.controller';
import { RequestTimeService } from './request-time.service';

@Module({
  imports: [ValidatorsStorageModule, QueueInfoStorageModule, ConfigModule, GenesisTimeModule],
  controllers: [RequestTimeController],
  providers: [RequestTimeService],
})
export class RequestTimeModule {}
