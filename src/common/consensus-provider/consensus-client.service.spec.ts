import { Test, TestingModule } from '@nestjs/testing';
import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { Readable } from 'stream';
import { ConsensusClientService } from './consensus-client.service';
import { ConsensusRetryService } from './consensus-retry.service';

describe('ConsensusClientService', () => {
  let moduleRef: TestingModule;
  let service: ConsensusClientService;
  let consensusProviderService: ConsensusProviderService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ConsensusClientService,
        {
          provide: ConsensusProviderService,
          useValue: {
            fetch: jest.fn(),
            fetchStream: jest.fn(),
          },
        },
        {
          provide: ConsensusRetryService,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<ConsensusClientService>(ConsensusClientService);
    consensusProviderService = moduleRef.get<ConsensusProviderService>(ConsensusProviderService);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.resetAllMocks();
  });

  // Gloas beacon-APIs registers the envelope route in plural form only
  // (/eth/v1/beacon/execution_payload_envelopes/{block_id}); the singular path 404s
  // on every post-fork payload lookup, so this test pins the exact URL.
  it('fetches the execution payload envelope from the plural spec path', async () => {
    const fetchSpy = jest.spyOn(consensusProviderService, 'fetch').mockResolvedValue({
      data: { message: { payload: { block_number: '12345', block_hash: '0x1' } } },
    } as any);

    await expect(service.getExecutionPayloadEnvelope('200')).resolves.toEqual({
      block_number: '12345',
      block_hash: '0x1',
    });
    expect(fetchSpy).toHaveBeenCalledWith('/eth/v1/beacon/execution_payload_envelopes/200');
  });

  it('counts exited builders from the dedicated builders endpoint', async () => {
    jest
      .spyOn(consensusProviderService, 'fetchStream')
      .mockResolvedValueOnce(
        Readable.from([
          JSON.stringify({
            data: {
              slot: '3200',
              builder_pending_withdrawals: [{}, {}],
            },
          }),
        ]) as any,
      )
      .mockResolvedValueOnce(
        Readable.from([
          JSON.stringify({
            data: [
              { index: '0', status: 'active', builder: { balance: '1', withdrawable_epoch: '100' } },
              { index: '1', status: 'active', builder: { balance: '1', withdrawable_epoch: '101' } },
              { index: '2', status: 'active', builder: { balance: '0', withdrawable_epoch: '99' } },
            ],
          }),
        ]) as any,
      );
    const retryService = moduleRef.get<ConsensusRetryService>(ConsensusRetryService);
    jest.spyOn(retryService, 'execute').mockImplementation(async (_operation, callback) => callback() as any);

    await expect(service.getStateSweepData('head', 100, true)).resolves.toEqual({
      slot: '3200',
      builder_pending_withdrawals_count: 2,
      exited_builder_withdrawals_count: 1,
    });
    expect(consensusProviderService.fetchStream).toHaveBeenNthCalledWith(2, '/eth/v1/beacon/states/head/builders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
  });

  it('does not request builders before Glamsterdam', async () => {
    const fetchStreamSpy = jest.spyOn(consensusProviderService, 'fetchStream').mockResolvedValue(
      Readable.from([
        JSON.stringify({
          data: {
            slot: '3200',
            next_withdrawal_validator_index: '42',
          },
        }),
      ]) as any,
    );
    const retryService = moduleRef.get<ConsensusRetryService>(ConsensusRetryService);
    jest.spyOn(retryService, 'execute').mockImplementation(async (_operation, callback) => callback() as any);

    await expect(service.getStateSweepData('head', 100, false)).resolves.toEqual({
      slot: '3200',
      next_withdrawal_validator_index: '42',
      builder_pending_withdrawals_count: 0,
      exited_builder_withdrawals_count: 0,
    });
    expect(fetchStreamSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['invalid balance', JSON.stringify({ data: [{ builder: { balance: 'invalid', withdrawable_epoch: '100' } }] })],
    ['missing builder', JSON.stringify({ data: [{}] })],
    ['truncated JSON', '{"data":['],
  ])('rejects %s so the caller can retry and closes the source', async (_description, response) => {
    const buildersStream = Readable.from([response]);
    jest
      .spyOn(consensusProviderService, 'fetchStream')
      .mockResolvedValueOnce(Readable.from(['{"data":{"slot":"3200"}}']) as any)
      .mockResolvedValueOnce(buildersStream as any);
    const retryService = moduleRef.get<ConsensusRetryService>(ConsensusRetryService);
    jest.spyOn(retryService, 'execute').mockImplementation(async (_operation, callback) => callback() as any);

    await expect(service.getStateSweepData('head', 100, true)).rejects.toThrow();
    expect(buildersStream.destroyed).toBe(true);
  });
});
