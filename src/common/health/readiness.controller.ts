import { Controller, Get, Header } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipCache } from 'common/decorators';
import { ConsensusDataHealthIndicator } from './consensus-data.indicator';
import { MAX_MEMORY_HEAP, READYZ_URL } from './health.constants';

@Controller(READYZ_URL)
@ApiExcludeController()
@SkipThrottle()
@SkipCache()
export class ReadinessController {
  constructor(
    protected readonly health: HealthCheckService,
    protected readonly memory: MemoryHealthIndicator,
    protected readonly consensusData: ConsensusDataHealthIndicator,
  ) {}

  // /readyz checks that request-time data has finished initializing and remains fresh.
  // It does not call EL or CL: temporary provider outages do not remove a pod
  // while its cached data remains fresh.
  @Get()
  @Header('Cache-Control', 'no-store')
  @HealthCheck()
  check() {
    return this.health.check([
      async () => this.memory.checkHeap('memoryHeap', MAX_MEMORY_HEAP),
      async () => this.consensusData.isHealthy('cachedConsensusData'),
    ]);
  }
}
