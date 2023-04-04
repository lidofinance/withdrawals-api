import { ExecutionContext } from '@nestjs/common';
import { CacheControlHeadersData } from './cache.interface';

export const isUndefined = (obj: any): obj is undefined => typeof obj === 'undefined';
export const isFunction = (val: any): boolean => typeof val === 'function';
export const isNil = (val: any): val is null | undefined => isUndefined(val) || val === null;
export const getCacheControlHeaders = ({ maxAge, staleIfError, staleWhileRevalidate }: CacheControlHeadersData) =>
  `public, max-age=${maxAge}, stale-if-error=${staleIfError}, stale-while-revalidate=${staleWhileRevalidate}`;
export const setCacheControlHeaders = (context: ExecutionContext, headers: string) => {
  const res = context.switchToHttp().getResponse();
  res.header('Cache-Control', headers);
};
