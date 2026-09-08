import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { HEALTH_URL, LIVEZ_URL } from 'common/health/health.constants';
import { METRICS_URL } from 'common/prometheus/prometheus.constants';

/**
 * Routes whose body must be recomputed on every request. Mirrors the
 * middleware exclusion list in `HTTPModule`.
 */
const NON_CACHEABLE_ROUTES = new Set([`/${HEALTH_URL}`, `/${LIVEZ_URL}`, `/${METRICS_URL}`]);

/**
 * `CacheInterceptor` caches every GET by URL, including routes that never
 * opted in with `@CacheTTL`. On a cache hit it resolves from the store and
 * never calls the handler, so a probe or a metrics scrape would be answered
 * with a stale body — and, for `/livez`, without the `no-store` header its
 * handler sets.
 *
 * Returning no key opts a route out: the upstream interceptor treats a falsy
 * key as "not cacheable" and delegates straight to the handler.
 */
@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): Promise<string | undefined | null> | string | undefined | null {
    return this.isNonCacheableRoute(context) ? undefined : super.trackBy(context);
  }

  private isNonCacheableRoute(context: ExecutionContext): boolean {
    const httpAdapter = this.httpAdapterHost?.httpAdapter;

    if (!httpAdapter?.getRequestUrl) return false;

    const url: string = httpAdapter.getRequestUrl(context.switchToHttp().getRequest()) ?? '';

    return NON_CACHEABLE_ROUTES.has(url.split('?')[0]);
  }
}
