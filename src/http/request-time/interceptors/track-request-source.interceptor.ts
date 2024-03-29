import { Injectable, ExecutionContext, CallHandler, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrometheusService } from 'common/prometheus';
import { REQUEST_SOURCE_HEADER } from '../headers/request-source-type';
import { getPathDetails } from 'common/utils/get-path-details';

@Injectable()
export class TrackRequestSourceInterceptor implements NestInterceptor {
  constructor(protected readonly prometheusService: PrometheusService) {}
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const requestSource = req.headers[REQUEST_SOURCE_HEADER.toLowerCase()];
    const { route, version } = getPathDetails(req.url);
    this.prometheusService.trackRequestSource(requestSource, route, version);
    return next.handle();
  }
}
