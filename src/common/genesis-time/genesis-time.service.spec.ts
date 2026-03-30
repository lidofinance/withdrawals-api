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
    jest.setSystemTime(1701385200000);
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
            getSpec: jest.fn(),
            getBlockHeaders: jest.fn(),
            getBlockV2: jest.fn(),
            fetch: jest.fn(),
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

  it(`inits correctly`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '10000',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {},
    });

    await moduleRef.init();

    const result = service.getGenesisTime();

    expect(result).toBe(10000);
  });

  it(`expected to fail when genesis time empty`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {},
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {},
    });

    await expect(moduleRef.init()).rejects.toEqual(new Error('Failed to get genesis time'));
  });

  it(`get current epoch`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {},
    });

    await moduleRef.init();

    const result = service.getCurrentEpoch();

    expect(result).toBe(246253);
  });

  it(`getFrameOfEpoch`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {},
    });
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(201600);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(225);

    await moduleRef.init();

    expect(service.getFrameOfEpoch(201600 + 224)).toBe(0);
    expect(service.getFrameOfEpoch(201600 + 225)).toBe(1);
    expect(service.getFrameOfEpoch(201600 + 450)).toBe(2);
  });

  it(`get frame of epoch`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {},
    });
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(201600);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(225);

    await moduleRef.init();

    expect(service.getFrameOfEpoch(201600 + 224)).toBe(0);
    expect(service.getFrameOfEpoch(201600 + 225)).toBe(1);
    expect(service.getFrameOfEpoch(201600 + 450)).toBe(2);
  });

  it(`time to withdrawal frame`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {},
    });
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(201600);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(225);

    await moduleRef.init();

    expect(service.timeToWithdrawalFrame(2000, 1703239938663)).toBe(153798484000);
  });

  it(`uses execution payload envelope after Glamsterdam`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {
        GLOAS_FORK_EPOCH: '5',
      },
    });
    jest.spyOn(consensusProvider, 'getBlockHeaders').mockResolvedValue({
      data: [
        {
          root: '0xpost-gloas-root',
          header: {
            message: {
              slot: '200',
            },
          },
        },
      ],
    } as any);
    const fetchSpy = jest.spyOn(consensusProvider, 'fetch').mockResolvedValue({
      data: {
        message: {
          payload: {
            block_number: '12345',
          },
        },
      },
    });
    const getBlockV2Spy = jest.spyOn(consensusProvider, 'getBlockV2');

    await moduleRef.init();

    await expect(service.getBlockBySlot(200)).resolves.toBe(12345);
    expect(fetchSpy).toHaveBeenCalledWith('/eth/v1/beacon/execution_payload_envelope/0xpost-gloas-root');
    expect(getBlockV2Spy).not.toHaveBeenCalled();
  });

  it(`uses legacy block payload before Glamsterdam`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {
        GLOAS_FORK_EPOCH: '10',
      },
    });
    jest.spyOn(consensusProvider, 'getBlockHeaders').mockResolvedValue({
      data: [
        {
          root: '0xpre-gloas-root',
          header: {
            message: {
              slot: '200',
            },
          },
        },
      ],
    } as any);
    const fetchSpy = jest.spyOn(consensusProvider, 'fetch');
    const getBlockV2Spy = jest.spyOn(consensusProvider, 'getBlockV2').mockResolvedValue({
      data: {
        message: {
          body: {
            execution_payload: {
              block_number: '67890',
            },
          },
        },
      },
    } as any);

    await moduleRef.init();

    await expect(service.getBlockBySlot(200)).resolves.toBe(67890);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getBlockV2Spy).toHaveBeenCalledWith({ blockId: '0xpre-gloas-root' });
  });

  it(`falls back to the latest existing block at or before slot`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({
      data: {
        GLOAS_FORK_EPOCH: '5',
      },
    });
    const getBlockHeadersSpy = jest
      .spyOn(consensusProvider, 'getBlockHeaders')
      .mockRejectedValueOnce({
        message: 'No blocks found',
        code: 404,
      })
      .mockResolvedValueOnce({
        data: [
          {
            root: '0xfallback-root',
            header: {
              message: {
                slot: '224',
              },
            },
          },
        ],
      } as any);
    jest.spyOn(consensusProvider, 'fetch').mockResolvedValue({
      data: {
        message: {
          payload: {
            block_number: '54321',
          },
        },
      },
    });

    await moduleRef.init();

    await expect(service.getBlockBySlot(225)).resolves.toBe(54321);
    expect(getBlockHeadersSpy).toHaveBeenNthCalledWith(1, { slot: '225' });
    expect(getBlockHeadersSpy).toHaveBeenNthCalledWith(2, { slot: '224' });
  });
});
