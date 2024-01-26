import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';
import { ConsensusProviderIndicator } from './consensus-provider.indicator';
import { GenesisTimeModule } from '../genesis-time';

@Module({
  providers: [ExecutionProviderHealthIndicator, ConsensusProviderIndicator],
  controllers: [HealthController],
  imports: [TerminusModule, GenesisTimeModule],
})
export class HealthModule {}
