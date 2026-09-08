import { HealthCheckService, MemoryHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HEALTH_URL, MAX_MEMORY_HEAP } from './health.constants';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';
import { ConsensusProviderIndicator } from './consensus-provider.indicator';

@Controller(HEALTH_URL)
@ApiExcludeController()
@SkipThrottle()
export class HealthController {
  constructor(
    protected health: HealthCheckService,
    protected memory: MemoryHealthIndicator,
    protected readonly executionProvider: ExecutionProviderHealthIndicator,
    protected readonly consensusProvider: ConsensusProviderIndicator,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @HealthCheck()
  check() {
    return this.health.check([
      async () => this.memory.checkHeap('memoryHeap', MAX_MEMORY_HEAP),
      async () => this.executionProvider.isHealthy('RPCProvider'),
      async () => this.consensusProvider.isHealthy('consensusProvider'),
    ]);
  }
}
