import { Inject, LoggerService, Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { LivenessController } from './liveness.controller';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';
import { ConsensusProviderIndicator } from './consensus-provider.indicator';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { GenesisTimeModule } from '../genesis-time';
import { ValidatorsStorageModule } from 'storage/validators/validators.module';
import { ConsensusDataHealthIndicator } from './consensus-data.indicator';
import { ReadinessController } from './readiness.controller';

@Module({
  providers: [ExecutionProviderHealthIndicator, ConsensusProviderIndicator, ConsensusDataHealthIndicator],
  controllers: [HealthController, LivenessController, ReadinessController],
  imports: [TerminusModule, GenesisTimeModule, ValidatorsStorageModule],
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
