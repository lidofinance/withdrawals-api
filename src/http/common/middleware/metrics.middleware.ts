import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Reply } from './interfaces';
import { PrometheusService } from 'common/prometheus';
import { HTTP_PATHS } from 'http/http.constants';

const getPathDetails = (originalUrl: string) => {
  try {
    const parts = originalUrl.split('/');
    const version = parseInt(parts[1].substring(1));
    const route = parts[2].split('?')[0];

    if (isNaN(version) || !HTTP_PATHS[version] || !HTTP_PATHS[version][route]) {
      return { version: HTTP_PATHS[version] ? version : 'unknown', route: 'unknown' };
    }

    return { version, route };
  } catch (error) {
    return { version: 'unknown', route: 'unknown' };
  }
};

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

      if (statusCode >= 200 && statusCode <= 299) {
        this.prometheusService.httpRequests.inc({ statusCode });
      } else {
        this.prometheusService.httpFailedRequests.inc({ statusCode });
      }
    });

    next();
  }
}
