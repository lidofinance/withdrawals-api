import { HealthCheckService, MemoryHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipCache } from 'common/decorators';
import { HEALTH_URL, MAX_MEMORY_HEAP } from './health.constants';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';
import { ConsensusProviderIndicator } from './consensus-provider.indicator';

@Controller(HEALTH_URL)
@ApiExcludeController()
@SkipThrottle()
@SkipCache()
export class HealthController {
  constructor(
    protected health: HealthCheckService,
    protected memory: MemoryHealthIndicator,
    protected readonly executionProvider: ExecutionProviderHealthIndicator,
    protected readonly consensusProvider: ConsensusProviderIndicator,
  ) {}

  // Readiness dependencies:
  //
  // - GET /v1/request-time uses job-updated in-memory data only.
  // - GET /v2/request-time, GET /v2/request-time/calculate, and request-ID lookups
  //   read current withdrawal state from EL and use validator data calculated from CL.
  //
  // Current infrastructure uses /health as its only readiness signal, so it cannot
  // report cached CL data separately. Keep the direct CL provider check here.
  // Keep readiness fail-closed when EL or CL is unavailable.
  // Otherwise, v2 endpoints can return failed or outdated withdrawal estimates.
  //
  // GET /v1/estimate-gas also calls EL, but returns a fallback value on failure.
  // NFT endpoints do not call EL.
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
