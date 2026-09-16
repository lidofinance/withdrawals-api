import { Controller, Get, Header, VersioningType } from '@nestjs/common';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { SkipThrottle, ThrottlerModule } from '@nestjs/throttler';
import { Cache } from 'cache-manager';
import { HealthCheckError, MemoryHealthIndicator, TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ExecutionProviderHealthIndicator } from './execution-provider.indicator';
import { ConsensusProviderIndicator } from './consensus-provider.indicator';
import { CacheControlHeadersInterceptor } from 'http/common/cache/cache-control-headers.interceptor';
import { HttpCacheInterceptor } from 'http/common/cache/http-cache.interceptor';
import { ThrottlerBehindProxyGuard } from 'http/common/throttler/throttler.guard';
import { SkipCache } from 'common/decorators';
import { setupServiceUnavailableMiddleware } from '../middlewares/service-unavailable.middleware';
import { LivenessController } from './liveness.controller';

jest.mock('common/config', () => ({}));

@Controller('test')
class TestController {
  calls = 0;

  @Get('cached')
  cached() {
    return { calls: ++this.calls };
  }
}

@Controller()
@SkipThrottle()
@SkipCache()
class OperationalController {
  scrapes = 0;

  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  metrics() {
    return `scrapes_total ${++this.scrapes}\n`;
  }
}

describe('Operational HTTP cache policy and liveness', () => {
  let app: NestFastifyApplication;
  let cache: Cache;
  let maintenance: boolean;
  let executionHealthy: boolean;
  let consensusHealthy: boolean;

  beforeEach(async () => {
    maintenance = false;
    executionHealthy = true;
    consensusHealthy = true;
    const config = {
      get: jest.fn((key: string) => (key === 'IS_SERVICE_UNAVAILABLE' ? maintenance : 3600)),
    };
    const module = await Test.createTestingModule({
      imports: [
        TerminusModule.forRoot({ logger: false }),
        CacheModule.register({ ttl: 3_600_000 }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }]),
      ],
      controllers: [HealthController, LivenessController, TestController, OperationalController],
      providers: [
        {
          provide: ExecutionProviderHealthIndicator,
          useValue: {
            isHealthy: jest.fn(async (key: string) => {
              if (!executionHealthy)
                throw new HealthCheckError('EL unavailable or stale', { [key]: { status: 'down' } });
              return { [key]: { status: 'up' } };
            }),
          },
        },
        {
          provide: ConsensusProviderIndicator,
          useValue: {
            isHealthy: jest.fn(async (key: string) => {
              if (!consensusHealthy)
                throw new HealthCheckError('CL unavailable or stale', { [key]: { status: 'down' } });
              return { [key]: { status: 'up' } };
            }),
          },
        },
        { provide: ConfigService, useValue: config },
        { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
        { provide: APP_INTERCEPTOR, useClass: CacheControlHeadersInterceptor },
        { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
      ],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.enableVersioning({ type: VersioningType.URI });
    setupServiceUnavailableMiddleware(app, app.get(ConfigService));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    cache = app.get(CACHE_MANAGER);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('executes every probe without cache access or rate limiting, even with a long TTL and an existing entry', async () => {
    await cache.set('/livez', { status: 'stale' });
    const get = jest.spyOn(cache, 'get');
    const set = jest.spyOn(cache, 'set');

    for (let i = 0; i < 5; i++) {
      const response = await app.inject({ method: 'GET', url: '/livez' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok', uptime: expect.any(Number) });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-cache']).toBeUndefined();
    }

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('remains live during maintenance while application requests return 503', async () => {
    maintenance = true;
    const probe = await app.inject({ method: 'GET', url: '/livez' });
    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toEqual({ status: 'ok', uptime: expect.any(Number) });
    expect(probe.headers['cache-control']).toBe('no-store');

    const response = await app.inject({ method: 'GET', url: '/test/cached' });
    expect(response.statusCode).toBe(503);
  });

  it.each(['/livez', '/livez?full=1', '/health', '/health?full=1', '/metrics', '/metrics?full=1'])(
    'bypasses cache reads and writes and sends no-store for %s',
    async (url) => {
      await cache.set(url, { status: 'stale' });
      const get = jest.spyOn(cache, 'get');
      const set = jest.spyOn(cache, 'set');

      for (let i = 0; i < 2; i++) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['x-cache']).toBeUndefined();
        if (url.startsWith('/metrics')) {
          expect(response.body).toBe(`scrapes_total ${i + 1}\n`);
        } else if (url.startsWith('/livez')) {
          expect(response.json()).toEqual({ status: 'ok', uptime: expect.any(Number) });
        } else {
          expect(response.json()).toMatchObject({
            status: 'ok',
            details: { RPCProvider: { status: 'up' }, consensusProvider: { status: 'up' } },
          });
        }
      }

      expect(get).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    },
  );

  it.each(['EL', 'CL'])('returns fresh 503 on %s failure, keeps liveness up, and recovers', async (provider) => {
    const healthy = await app.inject({ method: 'GET', url: '/health' });
    expect(healthy.statusCode).toBe(200);

    if (provider === 'EL') executionHealthy = false;
    else consensusHealthy = false;
    const unhealthy = await app.inject({ method: 'GET', url: '/health' });
    expect(unhealthy.statusCode).toBe(503);
    expect(unhealthy.headers['cache-control']).toBe('no-store');
    const key = provider === 'EL' ? 'RPCProvider' : 'consensusProvider';
    expect(unhealthy.json()).toMatchObject({ details: { [key]: { status: 'down' } } });

    const live = await app.inject({ method: 'GET', url: '/livez' });
    expect(live.statusCode).toBe(200);

    executionHealthy = true;
    consensusHealthy = true;
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect(app.get(ExecutionProviderHealthIndicator).isHealthy).toHaveBeenCalledTimes(3);
    expect(app.get(ConsensusProviderIndicator).isHealthy).toHaveBeenCalledTimes(3);
  });

  it('keeps the memory readiness check and bypasses probe rate limiting', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    }
    jest
      .spyOn(app.get(MemoryHealthIndicator), 'checkHeap')
      .mockRejectedValue(new HealthCheckError('Memory limit exceeded', { memoryHeap: { status: 'down' } }));
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ details: { memoryHeap: { status: 'down' } } });
  });

  it('preserves caching and throttling for ordinary routes', async () => {
    const first = await app.inject({ method: 'GET', url: '/test/cached' });
    const second = await app.inject({ method: 'GET', url: '/test/cached' });
    const third = await app.inject({ method: 'GET', url: '/test/cached' });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ calls: 1 });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.headers['cache-control']).toContain('max-age=3600');
    expect(third.statusCode).toBe(429);
  });
});
