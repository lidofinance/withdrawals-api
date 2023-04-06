import { HealthCheckService, MemoryHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HEALTH_URL, MAX_MEMORY_HEAP } from './health.constants';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';

@Controller(HEALTH_URL)
@ApiExcludeController()
export class HealthController {
  constructor(
    protected health: HealthCheckService,
    protected memory: MemoryHealthIndicator,
    protected readonly executionProvider: ExecutionProviderHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => this.memory.checkHeap('memoryHeap', MAX_MEMORY_HEAP),
      async () => this.executionProvider.isHealthy('RPCProvider'),
    ]);
  }
}
