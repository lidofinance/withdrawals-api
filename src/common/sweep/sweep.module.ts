import { Module } from '@nestjs/common';
import { ConsensusProviderModule } from 'common/consensus-provider';
import { GenesisTimeModule } from 'common/genesis-time';
import { LoggerModule } from 'common/logger';
import { SweepService } from './sweep.service';

@Module({
  imports: [LoggerModule, ConsensusProviderModule, GenesisTimeModule],
  providers: [SweepService],
  exports: [SweepService],
})
export class SweepModule {}
