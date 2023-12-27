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

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2023, 11, 1));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

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
        genesis_time: '10000',
      },
    });

    await moduleRef.init();

    const result = service.getGenesisTime();

    expect(result).toBe(10000);
  });

  it(`GenesisTimeService init expected to fail`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {},
    });

    await expect(moduleRef.init()).rejects.toEqual(new Error('Failed to get genesis time'));
  });

  it(`GenesisTimeService getCurrentEpoch`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });

    await moduleRef.init();

    const result = service.getCurrentEpoch();

    expect(result).toBe(246253);
  });

  it(`GenesisTimeService getFrameOfEpoch`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(201600);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(225);

    await moduleRef.init();

    expect(service.getFrameOfEpoch(201600 + 224)).toBe(0);
    expect(service.getFrameOfEpoch(201600 + 225)).toBe(1);
    expect(service.getFrameOfEpoch(201600 + 450)).toBe(2);
  });

  it(`GenesisTimeService time to frame`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(201600);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(225);

    await moduleRef.init();

    expect(service.getFrameOfEpoch(201600 + 224)).toBe(0);
    expect(service.getFrameOfEpoch(201600 + 225)).toBe(1);
    expect(service.getFrameOfEpoch(201600 + 450)).toBe(2);
  });

  it(`GenesisTimeService test timeToWithdrawalFrame`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(201600);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(225);

    await moduleRef.init();

    expect(service.timeToWithdrawalFrame(2000, 1703239938663)).toBe(153798484000);
  });
});
