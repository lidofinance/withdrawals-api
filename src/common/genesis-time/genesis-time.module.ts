import { Module } from '@nestjs/common';
import { ConsensusProviderModule } from 'common/consensus-provider';
import { LoggerModule } from 'common/logger';
import { GenesisTimeService } from './genesis-time.service';
import { ContractConfigStorageModule } from '../../storage';

@Module({
  imports: [LoggerModule, ConsensusProviderModule, ContractConfigStorageModule],
  providers: [GenesisTimeService],
  exports: [GenesisTimeService],
})
export class GenesisTimeModule {}
