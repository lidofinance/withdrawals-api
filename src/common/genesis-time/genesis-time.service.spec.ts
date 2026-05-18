import { Test, TestingModule } from '@nestjs/testing';
import { nullTransport, LoggerModule } from '@lido-nestjs/logger';
import { GenesisTimeService } from './genesis-time.service';
import { ConsensusExecutionPayloadService, ConsensusProviderService } from '../consensus-provider';
import { SpecService } from '../spec';
import { ContractConfigStorageService } from '../../storage';

jest.mock('common/config', () => ({}));

// @lido-nestjs/consensus@1.7.0 added genesis_validators_root and genesis_fork_version to the
// genesis response shape; tests only exercise genesis_time, so the others are placeholders.
const STUB_GENESIS_VALIDATORS_ROOT = '0x' + '0'.repeat(64);
const STUB_GENESIS_FORK_VERSION = '0x00000000';

describe('GenesisTimeService', () => {
  let moduleRef: TestingModule;
  let service: GenesisTimeService;
  let consensusProvider: ConsensusProviderService;
  let consensusExecutionPayloadService: ConsensusExecutionPayloadService;
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
            getBlockV2: jest.fn(),
          },
        },
        {
          provide: ConsensusExecutionPayloadService,
          useValue: {
            getExecutionPayload: jest.fn(),
          },
        },
        {
          provide: SpecService,
          useValue: {
            refreshGlamsterdamForkEpoch: jest.fn(),
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
    consensusExecutionPayloadService = moduleRef.get<ConsensusExecutionPayloadService>(
      ConsensusExecutionPayloadService,
    );
    contractConfig = moduleRef.get<ContractConfigStorageService>(ContractConfigStorageService);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
    jest.resetAllMocks();
  });

  it(`inits correctly`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '10000',
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({ data: { SECONDS_PER_SLOT: '12' } } as any);

    await moduleRef.init();

    const result = service.getGenesisTime();

    expect(result).toBe(10000);
    expect(service.getSecondsPerSlot()).toBe(12);
  });

  it(`expected to fail when genesis time empty`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {} as any,
    });

    await expect(moduleRef.init()).rejects.toEqual(new Error('Failed to get genesis time'));
  });

  it(`get current epoch`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({ data: { SECONDS_PER_SLOT: '12' } } as any);

    await moduleRef.init();

    const result = service.getCurrentEpoch();

    expect(result).toBe(246253);
  });

  it(`getFrameOfEpoch`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({ data: { SECONDS_PER_SLOT: '12' } } as any);
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
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({ data: { SECONDS_PER_SLOT: '12' } } as any);
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
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({ data: { SECONDS_PER_SLOT: '12' } } as any);
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(201600);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(225);

    await moduleRef.init();

    expect(service.timeToWithdrawalFrame(2000, 1703239938663)).toBe(153798484000);
  });

  it(`gets block number from consensus execution payload service`, async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({ data: { SECONDS_PER_SLOT: '12' } } as any);
    const getExecutionPayloadSpy = jest
      .spyOn(consensusExecutionPayloadService, 'getExecutionPayload')
      .mockResolvedValue({ block_number: '12345', block_hash: '0x1' });

    await moduleRef.init();

    await expect(service.getBlockBySlot(200)).resolves.toBe(12345);
    expect(getExecutionPayloadSpy).toHaveBeenCalledWith('200');
  });

  it('loads SECONDS_PER_SLOT from consensus spec when available', async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockResolvedValue({ data: { SECONDS_PER_SLOT: '6' } } as any);

    await moduleRef.init();

    expect(service.getSecondsPerSlot()).toBe(6);
  });

  it('falls back to 12 seconds per slot when consensus spec fetch fails', async () => {
    jest.spyOn(consensusProvider, 'getGenesis').mockResolvedValue({
      data: {
        genesis_time: '1606824023',
        genesis_validators_root: STUB_GENESIS_VALIDATORS_ROOT,
        genesis_fork_version: STUB_GENESIS_FORK_VERSION,
      },
    });
    jest.spyOn(consensusProvider, 'getSpec').mockRejectedValue(new Error('spec unavailable'));

    await moduleRef.init();

    expect(service.getSecondsPerSlot()).toBe(12);
  });
});
