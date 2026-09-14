import { PrometheusController as PrometheusControllerSource } from '@willsoto/nestjs-prometheus';
import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipCache } from 'common/decorators';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
@ApiExcludeController()
@SkipCache()
@SkipThrottle()
export class PrometheusController extends PrometheusControllerSource {
  @Get()
  @Header('Cache-Control', 'no-store')
  index(@Res({ passthrough: true }) response: unknown): Promise<string> {
    return super.index(response);
  }
}
