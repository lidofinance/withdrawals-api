jest.mock('common/config', () => ({ ConfigService: class {} }));

import { FetchService } from '@lido-nestjs/fetch';
import { PassThrough } from 'node:stream';
import { ConsensusFetchService } from './consensus-fetch.service';

describe('ConsensusFetchService request timeout', () => {
  const metric = () => ({ inc: jest.fn(), observe: jest.fn() });

  const createService = () =>
    new ConsensusFetchService(
      { baseUrls: ['https://consensus.example'] } as never,
      {} as never,
      { debug: jest.fn(), error: jest.fn() } as never,
      { get: jest.fn().mockReturnValue(1) } as never,
      {
        httpRpcRequestsTotal: metric(),
        httpRpcBatchSize: metric(),
        httpRpcResponseSeconds: metric(),
        httpRpcRequestPayloadBytes: metric(),
        httpRpcResponsePayloadBytes: metric(),
        rpcRequestTotal: metric(),
      } as never,
    ) as unknown as { request: (url: string) => Promise<unknown> };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('clears the timeout after the response stream ends', async () => {
    const body = new PassThrough();
    jest.spyOn(FetchService.prototype as any, 'request').mockResolvedValue({
      status: 200,
      url: 'https://consensus.example/validators',
      headers: { get: () => null, entries: () => [] },
      body,
    } as never);

    await createService().request('/eth/v1/beacon/states/head/validators');
    expect(jest.getTimerCount()).toBe(1);

    body.emit('end');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the timeout when the request fails', async () => {
    jest.spyOn(FetchService.prototype as any, 'request').mockRejectedValue(new Error('request failed'));

    await expect(createService().request('/eth/v1/beacon/states/head/validators')).rejects.toThrow('request failed');
    expect(jest.getTimerCount()).toBe(0);
  });
});
