import { SetMetadata } from '@nestjs/common';
import { CACHE_CONTROL_HEADERS_METADATA } from './cache.constants';
import { CacheControlHeadersData } from './cache.interface';

export const CacheControlHeaders = (data: CacheControlHeadersData) => SetMetadata(CACHE_CONTROL_HEADERS_METADATA, data);
