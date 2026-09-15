import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipCache } from 'common/decorators';
import { LIVEZ_URL } from './health.constants';

@Controller(LIVEZ_URL)
@ApiExcludeController()
@SkipThrottle()
@SkipCache()
export class LivenessController {
  @Get()
  @Header('Cache-Control', 'no-store')
  check() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }
}
