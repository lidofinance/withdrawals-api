import { Test, TestingModule } from '@nestjs/testing';
import { ConsensusExecutionPayloadService } from './consensus-execution-payload.service';
import { ConsensusClientService } from './consensus-client.service';
import { ConsensusProviderService } from './index';
import { SpecService } from '../spec';

describe('ConsensusExecutionPayloadService', () => {
  let moduleRef: TestingModule;
  let service: ConsensusExecutionPayloadService;
  let consensusProviderService: ConsensusProviderService;
  let consensusClientService: ConsensusClientService;
  let specService: SpecService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ConsensusExecutionPayloadService,
        {
          provide: ConsensusProviderService,
          useValue: {
            getBlockV2: jest.fn(),
          },
        },
        {
          provide: ConsensusClientService,
          useValue: {
            getExecutionPayloadEnvelope: jest.fn(),
          },
        },
        {
          provide: SpecService,
          useValue: {
            isGlamsterdamReleasedAtSlot: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<ConsensusExecutionPayloadService>(ConsensusExecutionPayloadService);
    consensusProviderService = moduleRef.get<ConsensusProviderService>(ConsensusProviderService);
    consensusClientService = moduleRef.get<ConsensusClientService>(ConsensusClientService);
    specService = moduleRef.get<SpecService>(SpecService);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.resetAllMocks();
  });

  it('uses execution payload envelope after Glamsterdam', async () => {
    jest.spyOn(consensusProviderService, 'getBlockV2').mockResolvedValue({
      data: {
        message: {
          slot: '200',
          body: {},
        },
      },
    } as any);
    jest.spyOn(specService, 'isGlamsterdamReleasedAtSlot').mockReturnValue(true);
    const getExecutionPayloadEnvelopeSpy = jest
      .spyOn(consensusClientService, 'getExecutionPayloadEnvelope')
      .mockResolvedValue({ block_number: '12345', block_hash: '0x1' });

    await expect(service.getExecutionPayload('200')).resolves.toEqual({ block_number: '12345', block_hash: '0x1' });
    expect(getExecutionPayloadEnvelopeSpy).toHaveBeenCalledWith('200');
  });

  it('uses legacy block payload before Glamsterdam', async () => {
    const getBlockV2Spy = jest.spyOn(consensusProviderService, 'getBlockV2').mockResolvedValue({
      data: {
        message: {
          slot: '200',
          body: {
            execution_payload: {
              block_number: '67890',
              block_hash: '0x2',
            },
          },
        },
      },
    } as any);
    jest.spyOn(specService, 'isGlamsterdamReleasedAtSlot').mockReturnValue(false);
    const getExecutionPayloadEnvelopeSpy = jest.spyOn(consensusClientService, 'getExecutionPayloadEnvelope');

    await expect(service.getExecutionPayload('200')).resolves.toEqual({ block_number: '67890', block_hash: '0x2' });
    expect(getBlockV2Spy).toHaveBeenCalledWith({ blockId: '200' });
    expect(getExecutionPayloadEnvelopeSpy).not.toHaveBeenCalled();
  });
});
