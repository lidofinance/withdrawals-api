import {
  Injectable,
  ExecutionContext,
  CallHandler,
  CacheInterceptor,
  CACHE_TTL_METADATA,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getCacheControlHeaders, setCacheControlHeaders, isFunction, isNil } from './cache.utils';
import {
  CACHE_CONTROL_HEADERS_METADATA,
  CACHE_DEFAULT_ERROR_HEADERS,
  DEFAULT_STALE_WHILE_REVALIDATE,
  DEFAULT_STALE_IF_ERROR,
} from './cache.constants';
import { CacheControlHeadersData } from './cache.interface';

/**
 * @deprecated
 */
@Injectable()
export class CacheWithHeadersInterceptor extends CacheInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const key = this.trackBy(context);
    const ttlValueOrFactory = this.reflector.get(CACHE_TTL_METADATA, context.getHandler()) ?? null;
    const ttl = isFunction(ttlValueOrFactory) ? await ttlValueOrFactory(context) : ttlValueOrFactory;
    const {
      maxAge = ttl,
      staleIfError = DEFAULT_STALE_IF_ERROR,
      staleWhileRevalidate = DEFAULT_STALE_WHILE_REVALIDATE,
    }: CacheControlHeadersData = this.reflector.get(CACHE_CONTROL_HEADERS_METADATA, context.getHandler()) ?? {};
    const isNeedCacheControlHeaders = !isNil(maxAge);

    if (isNeedCacheControlHeaders) {
      setCacheControlHeaders(context, getCacheControlHeaders({ maxAge, staleIfError, staleWhileRevalidate }));
    }
    if (!key) return next.handle();

    try {
      const value = await this.cacheManager.get(key);
      if (!isNil(value)) {
        return of(value);
      }

      return next.handle().pipe(
        tap({
          next: async (response) => {
            const args = isNil(ttl) ? [key, response] : [key, response, ttl * 1000];

            try {
              await this.cacheManager.set(...args);
            } catch (err) {
              // TODO: replace with this.logger
              Logger.error(
                `An error has occured when inserting "key: ${key}", "value: ${response}"`,
                'CacheInterceptor',
              );
            }
          },
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
