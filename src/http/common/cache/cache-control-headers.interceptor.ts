import { Injectable, ExecutionContext, CallHandler, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_TTL_METADATA } from '@nestjs/cache-manager';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getCacheControlHeaders, isFunction, isNil, setCacheControlHeaders } from './cache.utils';
import {
  CACHE_CONTROL_HEADERS_METADATA,
  CACHE_DEFAULT_ERROR_HEADERS,
  DEFAULT_STALE_IF_ERROR,
  DEFAULT_STALE_WHILE_REVALIDATE,
} from './cache.constants';
import { CacheControlHeadersData } from './cache.interface';

@Injectable()
export class CacheControlHeadersInterceptor implements NestInterceptor {
  constructor(protected readonly reflector: Reflector) {}
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    try {
      const ttlValueOrFactory = this.reflector.get(CACHE_TTL_METADATA, context.getHandler()) ?? null;
      const ttlMilliseconds = isFunction(ttlValueOrFactory) ? await ttlValueOrFactory(context) : ttlValueOrFactory;
      const ttl = isNil(ttlMilliseconds) ? null : Math.floor(ttlMilliseconds / 1000);
      const {
        maxAge = ttl,
        staleIfError = DEFAULT_STALE_IF_ERROR,
        staleWhileRevalidate = DEFAULT_STALE_WHILE_REVALIDATE,
      }: CacheControlHeadersData = this.reflector.get(CACHE_CONTROL_HEADERS_METADATA, context.getHandler()) ??
      ({} as CacheControlHeadersData);

      const isNeedCacheControlHeaders = !isNil(maxAge);

      if (isNeedCacheControlHeaders) {
        setCacheControlHeaders(context, getCacheControlHeaders({ maxAge, staleIfError, staleWhileRevalidate }));
      }

      return next.handle().pipe(
        tap({
          error: () => {
            if (isNeedCacheControlHeaders) {
              // for requests with cache-control headers
              // need set new headers otherwise error will be cached
              setCacheControlHeaders(context, CACHE_DEFAULT_ERROR_HEADERS);
              // for /image endpoint
              const res = context.switchToHttp().getResponse();
              res.header('Content-Type', 'application/json; charset=utf-8');
            }
          },
        }),
      );
    } catch (err) {
      return next.handle();
    }
  }
}
