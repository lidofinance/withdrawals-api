import { HealthCheckService, MemoryHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipCache } from 'common/decorators';
import { HEALTH_URL, MAX_MEMORY_HEAP } from './health.constants';

@Controller(HEALTH_URL)
@ApiExcludeController()
@SkipThrottle()
@SkipCache()
export class HealthController {
  constructor(protected health: HealthCheckService, protected memory: MemoryHealthIndicator) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @HealthCheck()
  check() {
    return this.health.check([async () => this.memory.checkHeap('memoryHeap', MAX_MEMORY_HEAP)]);
  }
}
