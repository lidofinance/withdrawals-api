import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

import { HEALTH_URL } from 'common/health';
import { METRICS_URL } from 'common/prometheus';

import { SWAGGER_URL } from './common/swagger';
import { ThrottlerModule, ThrottlerBehindProxyGuard } from './common/throttler';
import { LoggerMiddleware, MetricsMiddleware } from './common/middleware';
import { CacheModule, CacheControlHeadersInterceptor } from './common/cache';
import { RequestTimeModule } from './request-time';
import { NFTModule } from './nft';
import { EstimateModule } from './estimate';
import { ValidatorsModule } from './validators';

@Module({
  imports: [RequestTimeModule, NFTModule, EstimateModule, ValidatorsModule, CacheModule, ThrottlerModule],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheControlHeadersInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
  ],
})
export class HTTPModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsMiddleware, LoggerMiddleware)
      .exclude(`${SWAGGER_URL}/(.*)`, SWAGGER_URL, METRICS_URL, HEALTH_URL)
      .forRoutes('*');
  }
}
