import { PrometheusController as PrometheusControllerSource } from '@willsoto/nestjs-prometheus';
import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller()
@ApiExcludeController()
export class PrometheusController extends PrometheusControllerSource {
  @Get()
  @Header('Cache-Control', 'no-store')
  index(@Res({ passthrough: true }) response: unknown): Promise<string> {
    return super.index(response);
  }
}
