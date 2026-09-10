import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { SKIP_CACHE_KEY } from 'common/decorators';

/**
 * `CacheInterceptor` caches every GET by URL, including routes that never
 * opted in with `@CacheTTL`. On a cache hit it resolves from the store and
 * never calls the handler, so a probe or a metrics scrape would be answered
 * with a stale body — and, for `/livez`, without the `no-store` header its
 * handler sets. Routes opt out with `@SkipCache()` instead of being listed
 * here, so the exclusion travels with the controller rather than a URL string
 * kept in sync by hand.
 *
 * Returning no key opts a route out: the upstream interceptor treats a falsy
 * key as "not cacheable" and delegates straight to the handler.
 */
@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): Promise<string | undefined | null> | string | undefined | null {
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(SKIP_CACHE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (shouldSkip) return undefined;

    return super.trackBy(context);
  }
}
