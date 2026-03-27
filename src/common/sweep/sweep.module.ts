import { Module } from '@nestjs/common';
import { ConsensusProviderModule } from 'common/consensus-provider';
import { LoggerModule } from 'common/logger';
import { SweepService } from './sweep.service';

@Module({
  imports: [LoggerModule, ConsensusProviderModule],
  providers: [SweepService],
  exports: [SweepService],
})
export class SweepModule {}
