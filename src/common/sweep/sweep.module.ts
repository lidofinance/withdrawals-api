import { Module } from '@nestjs/common';
import { ConsensusProviderModule } from 'common/consensus-provider';
import { LoggerModule } from 'common/logger';
import { SweepService } from './sweep.service';
import { ContractConfigStorageModule } from '../../storage';
import { GenesisTimeModule } from '../genesis-time';

@Module({
  imports: [LoggerModule, ConsensusProviderModule, ContractConfigStorageModule, GenesisTimeModule],
  providers: [SweepService],
  exports: [SweepService],
})
export class SweepModule {}
