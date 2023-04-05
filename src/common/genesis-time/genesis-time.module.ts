import { Module } from '@nestjs/common';
import { ConsensusProviderModule } from 'common/consensus-provider';
import { LoggerModule } from 'common/logger';
import { GenesisTimeService } from './genesis-time.service';

@Module({
  imports: [LoggerModule, ConsensusProviderModule],
  providers: [GenesisTimeService],
  exports: [GenesisTimeService],
})
export class GenesisTimeModule {}
