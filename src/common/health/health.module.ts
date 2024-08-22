import { Inject, LoggerService, Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';
import { ConsensusProviderIndicator } from './consensus-provider.indicator';
import { GenesisTimeModule } from '../genesis-time';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

@Module({
  providers: [ExecutionProviderHealthIndicator, ConsensusProviderIndicator],
  controllers: [HealthController],
  imports: [TerminusModule, GenesisTimeModule],
})
export class HealthModule implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly consensusProviderIndicator: ConsensusProviderIndicator,
    protected readonly executionProviderIndicator: ExecutionProviderHealthIndicator,
  ) {}

  async onModuleInit() {
    await this.startUpChecks();
  }

  async startUpChecks() {
    try {
      await this.consensusProviderIndicator.isHealthy('consensusProvider');
      await this.executionProviderIndicator.isHealthy('executionProvider');
      this.logger.log(`Start up checks passed successfully`);
    } catch (e) {
      this.logger.error(`Start up checks failed with error: ${e}`);
    }
  }
}
