import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Reply } from './interfaces';
import { PrometheusService } from 'common/prometheus';
import { getPathDetails } from 'common/utils/get-path-details';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(protected readonly prometheusService: PrometheusService) {}

  use(request: Request, reply: Reply, next: () => void) {
    const { method } = request;
    const { version, route } = getPathDetails(request.originalUrl);
    const metricsData = { method };
    if (version && route) {
      metricsData['version'] = version;
      metricsData['route'] = route;
    }

    const endTimer = this.prometheusService.httpRequestDuration.startTimer(metricsData);

    reply.on('finish', () => {
      const { statusCode } = reply;
      endTimer({ statusCode });
    });

    next();
  }
}
