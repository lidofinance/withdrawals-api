import { Test, TestingModule } from '@nestjs/testing';
import { nullTransport, LoggerModule } from '@lido-nestjs/logger';
import { GenesisTimeService } from './genesis-time.service';
import { ConsensusProviderService } from '../consensus-provider';
import { ContractConfigStorageService } from '../../storage';

jest.mock('common/config', () => ({}));

describe('GenesisTimeService', () => {
  let moduleRef: TestingModule;
  let service: GenesisTimeService;
  let consensusProvider: ConsensusProviderService;
  let contractConfig: ContractConfigStorageService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ transports: [nullTransport()] })],
      providers: [
        GenesisTimeService,
        {
          provide: ConsensusProviderService,
          useValue: {
            getGenesis: jest.fn(),
          },
        },
        {
          provide: ContractConfigStorageService,
          useValue: {
            getInitialEpoch: jest.fn(),
            getEpochsPerFrame: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<GenesisTimeService>(GenesisTimeService);
    consensusProvider = moduleRef.get<ConsensusProviderService>(ConsensusProviderService);
    contractConfig = moduleRef.get<ContractConfigStorageService>(ContractConfigStorageService);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.resetAllMocks();
  });

  it(`GenesisTimeService init correctly`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: 10000,
      },
    } as unknown as any);

    await moduleRef.init();

    const result = service.getGenesisTime();

    expect(result).toBe(10000);
  });

  it(`GenesisTimeService init expected to fail`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {},
    } as unknown as any);

    await expect(moduleRef.init()).rejects.toEqual(new Error('Failed to get genesis time'));
  });
});
