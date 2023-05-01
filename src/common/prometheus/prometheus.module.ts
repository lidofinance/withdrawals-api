import { Global, Module } from '@nestjs/common';
import { PrometheusModule as PrometheusModuleSource } from '@willsoto/nestjs-prometheus';
import { METRICS_URL, METRICS_PREFIX } from './prometheus.constants';
import { PrometheusController } from './prometheus.controller';
import { PrometheusService } from './prometheus.service';

@Global()
@Module({
  imports: [
    PrometheusModuleSource.register({
      controller: PrometheusController,
      path: METRICS_URL,
      defaultMetrics: { enabled: true, config: { prefix: METRICS_PREFIX } },
    }),
  ],
  providers: [PrometheusService],
  exports: [PrometheusService],
})
export class PrometheusModule {}
