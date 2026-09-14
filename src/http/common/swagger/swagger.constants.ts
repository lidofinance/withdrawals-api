import { getCacheControlHeaders } from '../cache/cache.utils';
import { DEFAULT_STALE_IF_ERROR, DEFAULT_STALE_WHILE_REVALIDATE } from '../cache/cache.constants';

export const SWAGGER_URL = 'api';
export const SWAGGER_CACHE_MAX_AGE = 120;
export const SWAGGER_CACHE_CONTROL = getCacheControlHeaders({
  maxAge: SWAGGER_CACHE_MAX_AGE,
  staleIfError: DEFAULT_STALE_IF_ERROR,
  staleWhileRevalidate: DEFAULT_STALE_WHILE_REVALIDATE,
});
