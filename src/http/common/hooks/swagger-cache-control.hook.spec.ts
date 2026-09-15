import { FastifyReply, FastifyRequest } from 'fastify';

import { CACHE_DEFAULT_ERROR_HEADERS } from '../cache/cache.constants';
import { SWAGGER_CACHE_CONTROL } from '../swagger';
import { swaggerCacheControlHook } from './swagger-cache-control.hook';

const request = (url: string) => ({ raw: { url } } as FastifyRequest);
const reply = (statusCode: number) => ({ statusCode, header: jest.fn() } as unknown as FastifyReply);

describe('swaggerCacheControlHook', () => {
  it('caches successful swagger responses', async () => {
    const res = reply(200);

    await swaggerCacheControlHook.call(null as any, request('/api-json'), res, 'payload');

    expect(res.header).toHaveBeenCalledWith('Cache-Control', SWAGGER_CACHE_CONTROL);
  });

  it('does not cache swagger errors', async () => {
    const res = reply(404);

    await swaggerCacheControlHook.call(null as any, request('/api/LICENSE'), res, 'payload');

    expect(res.header).toHaveBeenCalledWith('Cache-Control', CACHE_DEFAULT_ERROR_HEADERS);
  });

  it('leaves non-swagger responses untouched', async () => {
    const res = reply(200);

    await swaggerCacheControlHook.call(null as any, request('/v1/request-time'), res, 'payload');

    expect(res.header).not.toHaveBeenCalled();
  });

  it('returns the payload unchanged', async () => {
    const payload = 'payload';

    await expect(swaggerCacheControlHook.call(null as any, request('/api'), reply(200), payload)).resolves.toBe(
      payload,
    );
  });
});
