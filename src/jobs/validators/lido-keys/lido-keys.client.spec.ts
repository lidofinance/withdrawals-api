import { Test, TestingModule } from '@nestjs/testing';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { ConfigService } from 'common/config';
import { PrometheusService } from 'common/prometheus/prometheus.service';
import { LidoKeysClient } from './lido-keys.client';

jest.mock('common/config', () => ({ ConfigService: class {} }));

describe('LidoKeysClient request metrics', () => {
  let module: TestingModule;
  let client: LidoKeysClient;
  let metrics: PrometheusService;
  let fetchMock: jest.SpyInstance;

  const data = {
    data: [],
    meta: { elBlockSnapshot: { blockNumber: 1, blockHash: '0x1', timestamp: 1 } },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        LidoKeysClient,
        PrometheusService,
        { provide: LOGGER_PROVIDER, useValue: { error: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { getKeysApiBasePath: jest.fn().mockResolvedValue('https://keys.example') },
        },
      ],
    }).compile();
    await module.init();
    client = module.get(LidoKeysClient);
    metrics = module.get(PrometheusService);
    metrics.outgoingApiRequestsTotal.reset();
    metrics.outgoingApiRequestDuration.reset();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module?.close();
  });

  async function expectOneRequest(status: string) {
    const labels = { target: 'lido-keys-api', status };
    const counter = await metrics.outgoingApiRequestsTotal.get();
    expect(counter.values).toEqual([expect.objectContaining({ labels, value: 1 })]);

    const histogram = await metrics.outgoingApiRequestDuration.get();
    expect(histogram.values.filter((value) => value.metricName.endsWith('_count'))).toEqual([
      expect.objectContaining({ labels, value: 1 }),
    ]);
    const sum = histogram.values.find((value) => value.metricName.endsWith('_sum'));
    expect(sum.labels).toEqual(labels);
    expect(sum.value).toBeGreaterThanOrEqual(0);
  }

  it('returns Keys API data and records the HTTP status once', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));

    await expect(client.getUsedKeys()).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith('https://keys.example/v1/keys?used=true', { method: 'GET' });
    await expectOneRequest('200');
  });

  it('records transport failures and propagates the original error', async () => {
    const error = new TypeError('fetch failed');
    fetchMock.mockRejectedValue(error);

    await expect(client.getUsedKeys()).rejects.toBe(error);
    await expectOneRequest('network_error');
  });

  it.each([200, 503])('preserves HTTP status %s when body decoding fails', async (status) => {
    fetchMock.mockResolvedValue(new Response('invalid JSON', { status }));

    await expect(client.getUsedKeys()).rejects.toMatchObject({ name: 'SyntaxError' });
    await expectOneRequest(String(status));
  });

  it('measures until the response body has been decoded', async () => {
    let resolveBody: (value: typeof data) => void;
    let bodyStarted: () => void;
    const started = new Promise<void>((resolve) => (bodyStarted = resolve));
    const body = new Promise<typeof data>((resolve) => (resolveBody = resolve));
    fetchMock.mockResolvedValue({
      status: 200,
      json: () => {
        bodyStarted();
        return body;
      },
    });

    const request = client.getUsedKeys();
    await started;
    expect((await metrics.outgoingApiRequestsTotal.get()).values).toEqual([]);
    expect((await metrics.outgoingApiRequestDuration.get()).values).toEqual([]);

    resolveBody(data);
    await expect(request).resolves.toEqual(data);
    await expectOneRequest('200');
  });
});
