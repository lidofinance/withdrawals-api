import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';

@Module({
  providers: [ExecutionProviderHealthIndicator],
  controllers: [HealthController],
  imports: [TerminusModule],
})
export class HealthModule {}
