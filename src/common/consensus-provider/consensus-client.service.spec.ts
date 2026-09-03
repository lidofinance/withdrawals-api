import { Test, TestingModule } from '@nestjs/testing';
import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
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
});
