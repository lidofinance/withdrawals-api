import { Test, TestingModule } from '@nestjs/testing';
import { nullTransport, LoggerModule } from '@lido-nestjs/logger';
import {
  ContractConfigStorageService,
  QueueInfoStorageService,
  RewardsStorageService,
  ValidatorsStorageService,
} from '../../storage';
import { RequestTimeService } from './request-time.service';
import { BigNumber } from '@ethersproject/bignumber';
import { LIDO_CONTRACT_TOKEN, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { GenesisTimeService } from 'common/genesis-time/genesis-time.service';
import { RewardsService } from 'events/rewards/rewards.service';
import { RequestTimeCalculationType } from './dto/request-time-calculation-type';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from '../../common/genesis-time';

jest.mock('common/config', () => ({}));

describe('RequestTimeService', () => {
  let moduleRef: TestingModule;
  let service: RequestTimeService;
  let rewardsStorage: RewardsStorageService;
  let contractConfig: ContractConfigStorageService;
  let genesisTimeService: GenesisTimeService;
  let validatorsStorage: ValidatorsStorageService;

  // constants
  const genesisTime = 1606824023;
  const rewardsPerFrame = BigNumber.from('1007748958196602737137');
  const currentEpoch = 252025;
  const initialEpoch = 201600;
  const epochPerFrame = 225;
  const lockedSystemTimestamp = 1703601993996; // 2023-12-26T14:46:33.996Z

  // mocks
  const getFrameOfEpochMock = (epoch) => {
    return Math.floor((epoch - initialEpoch) / epochPerFrame);
  };
  const getFrameByTimestampMock = (timestamp: number) => {
    const secondsFromInitialEpochToTimestamp =
      timestamp / 1000 - (genesisTime + initialEpoch * SECONDS_PER_SLOT * SLOTS_PER_EPOCH);
    return Math.floor(secondsFromInitialEpochToTimestamp / (epochPerFrame * SECONDS_PER_SLOT * SLOTS_PER_EPOCH));
  };
  const timeToWithdrawalFrameMock = (frame: number, from: number) => {
    const epochOfNextReport = initialEpoch + frame * epochPerFrame;
    const timeToNextReport = epochOfNextReport * SECONDS_PER_SLOT * SLOTS_PER_EPOCH;
    return Math.round(genesisTime + timeToNextReport - from / 1000) * 1000; // in ms
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(lockedSystemTimestamp));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ transports: [nullTransport()] })],
      providers: [
        RequestTimeService,
        {
          provide: ContractConfigStorageService,
          useValue: {
            getEpochsPerFrame: jest.fn(),
            getInitialEpoch: jest.fn(),
            getMaxValidatorExitRequestsPerReport: jest.fn(),
            getEpochsPerFrameVEBO: jest.fn(),
            getRequestTimestampMargin: jest.fn(),
          },
        },
        {
          provide: WITHDRAWAL_QUEUE_CONTRACT_TOKEN,
          useValue: {
            unfinalizedStETH: jest.fn(),
          },
        },
        {
          provide: LIDO_CONTRACT_TOKEN,
          useValue: {
            getBufferedEther: jest.fn(),
            getDepositableEther: jest.fn(),
          },
        },
        {
          provide: RewardsStorageService,
          useValue: {
            getRewardsPerFrame: jest.fn(),
          },
        },
        {
          provide: QueueInfoStorageService,
          useValue: {},
        },
        {
          provide: ValidatorsStorageService,
          useValue: {
            getTotal: jest.fn(),
          },
        },
        {
          provide: GenesisTimeService,
          useValue: {
            getCurrentEpoch: jest.fn(),
            getFrameOfEpoch: jest.fn(),
            getFrameByTimestamp: jest.fn(),
            timeToWithdrawalFrame: jest.fn(),
            getGenesis: jest.fn(),
          },
        },
        {
          provide: RewardsService,
          useValue: {},
        },
      ],
    }).compile();

    service = moduleRef.get<RequestTimeService>(RequestTimeService);
    rewardsStorage = moduleRef.get<RewardsStorageService>(RewardsStorageService);
    contractConfig = moduleRef.get<ContractConfigStorageService>(ContractConfigStorageService);
    genesisTimeService = moduleRef.get<GenesisTimeService>(GenesisTimeService);
    validatorsStorage = moduleRef.get<ValidatorsStorageService>(ValidatorsStorageService);

    // mocks
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(initialEpoch);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(epochPerFrame);
    jest.spyOn(contractConfig, 'getMaxValidatorExitRequestsPerReport').mockReturnValue(600);
    jest.spyOn(contractConfig, 'getEpochsPerFrameVEBO').mockReturnValue(75);
    jest.spyOn(contractConfig, 'getRequestTimestampMargin').mockReturnValue(7680000);
    jest.spyOn(genesisTimeService, 'getCurrentEpoch').mockReturnValue(currentEpoch);
    jest.spyOn(genesisTimeService, 'getFrameOfEpoch').mockImplementation(getFrameOfEpochMock);
    jest.spyOn(genesisTimeService, 'getFrameByTimestamp').mockImplementation(getFrameByTimestampMock);
    jest.spyOn(genesisTimeService, 'timeToWithdrawalFrame').mockImplementation(timeToWithdrawalFrameMock);
    jest.spyOn(rewardsStorage, 'getRewardsPerFrame').mockReturnValue(rewardsPerFrame);
    jest.spyOn(validatorsStorage, 'getTotal').mockReturnValue(10000);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.resetAllMocks();
  });

  it(`calculates frame by rewards only`, () => {
    const countFrames = 3;
    const expectedResult = getFrameOfEpochMock(currentEpoch) + countFrames + 1;
    const result = service.calculateFrameByRewardsOnly(BigNumber.from(rewardsPerFrame).mul(countFrames));

    expect(result).toBe(expectedResult);
  });

  it(`calculates withdrawal type buffer`, async () => {
    const result1 = await service.calculateWithdrawalTimeV2({
      unfinalized: BigNumber.from('1007748958196602737132'),
      buffer: BigNumber.from('1007748958196602737137'),
      vaultsBalance: BigNumber.from('0'),
      requestTimestamp: lockedSystemTimestamp,
      latestEpoch: '312321',
    });

    expect(result1.type).toBe(RequestTimeCalculationType.buffer);
  });

  it(`calculates withdrawal type requestTimestampMargin`, async () => {
    const result = await service.calculateWithdrawalTimeV2({
      unfinalized: BigNumber.from('1007748958196602737132'),
      buffer: BigNumber.from('1007748958196602737137'),
      vaultsBalance: BigNumber.from('0'),
      requestTimestamp: 1703687441739,
      latestEpoch: '312321',
    });

    expect(result.type).toBe(RequestTimeCalculationType.requestTimestampMargin);
  });

  it(`calculates withdrawal type vaultsBalance`, async () => {
    const result = await service.calculateWithdrawalTimeV2({
      unfinalized: BigNumber.from('1007748958196602737138'),
      buffer: BigNumber.from('1007748958196602737137'),
      vaultsBalance: BigNumber.from('2'),
      requestTimestamp: lockedSystemTimestamp,
      latestEpoch: '312321',
    });

    expect(result.type).toBe(RequestTimeCalculationType.vaultsBalance);
  });

  it(`calculates withdrawal type rewardsOnly`, async () => {
    const result = await service.calculateWithdrawalTimeV2({
      unfinalized: BigNumber.from('1007748958196602737138'),
      buffer: BigNumber.from('1007748958196602737137'),
      vaultsBalance: BigNumber.from('0'),
      requestTimestamp: lockedSystemTimestamp,
      latestEpoch: '312321',
    });

    expect(result.type).toBe(RequestTimeCalculationType.rewardsOnly);
  });

  it(`calculates withdrawal type exit validators`, async () => {
    const result = await service.calculateWithdrawalTimeV2({
      unfinalized: BigNumber.from('10000007748958196602737138'),
      buffer: BigNumber.from('0'),
      vaultsBalance: BigNumber.from('0'),
      requestTimestamp: lockedSystemTimestamp,
      latestEpoch: '312321',
    });

    expect(result.type).toBe(RequestTimeCalculationType.exitValidators);
  });
});
