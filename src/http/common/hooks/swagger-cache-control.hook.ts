import { onSendAsyncHookHandler } from 'fastify';

import { CACHE_DEFAULT_ERROR_HEADERS } from '../cache/cache.constants';
import { SWAGGER_CACHE_CONTROL, isSwaggerPath } from '../swagger';

// The signature must stay 3-arity: fastify rejects an async onSend taking 4 arguments.
export const swaggerCacheControlHook: onSendAsyncHookHandler = async (request, reply, payload) => {
  if (isSwaggerPath(request.raw.url ?? '')) {
    reply.header('Cache-Control', reply.statusCode < 400 ? SWAGGER_CACHE_CONTROL : CACHE_DEFAULT_ERROR_HEADERS);
  }

  return payload;
};
