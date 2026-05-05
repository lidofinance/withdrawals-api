import { Test, TestingModule } from '@nestjs/testing';
import { nullTransport, LoggerModule } from '@lido-nestjs/logger';
import {
  ContractConfigStorageService,
  QueueInfoStorageService,
  RewardsStorageService,
  ValidatorsStorageService,
} from 'storage';
import { WaitingTimeService } from './waiting-time.service';
import { BigNumber } from '@ethersproject/bignumber';
import { GenesisTimeService } from 'common/genesis-time/genesis-time.service';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';

import { WaitingTimeCalculationType } from './waiting-time.types';
import { PrometheusService } from '../common/prometheus';
import { BlockStateCacheService } from './block-state-cache.service';
import { QueueInfoService } from '../jobs/queue-info';

jest.mock('common/config', () => ({}));

describe('WaitingTimeService', () => {
  let moduleRef: TestingModule;
  let service: WaitingTimeService;
  let rewardsStorage: RewardsStorageService;
  let contractConfig: ContractConfigStorageService;
  let genesisTimeService: GenesisTimeService;
  let validatorsStorage: ValidatorsStorageService;
  let queueInfoStorageService: QueueInfoStorageService;

  // constants
  const genesisTime = 1606824023;
  const rewardsPerFrame = BigNumber.from('1007748958196602737137');
  const currentEpoch = 252025;
  const initialEpoch = 201600;
  const epochPerFrame = 225;
  const lockedSystemTimestamp = 1703601993996; // 2023-12-26T14:46:33.996Z
  const frameBalancesMock = {
    '250': BigNumber.from('10000007748958196602737139'),
    '252': BigNumber.from('10000007748958196602737138'),
    '254': BigNumber.from('10000007748958196602737138'),
  };

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
        WaitingTimeService,
        {
          provide: ContractConfigStorageService,
          useValue: {
            getEpochsPerFrame: jest.fn(),
            getInitialEpoch: jest.fn(),
            getMaxValidatorExitRequestsPerReport: jest.fn(),
            getEpochsPerFrameVEBO: jest.fn(),
            getRequestTimestampMargin: jest.fn(),
            getLastUpdate: jest.fn(),
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
          useValue: {
            getRequests: jest.fn(),
            getLastUpdate: jest.fn(),
          },
        },
        {
          provide: ValidatorsStorageService,
          useValue: {
            getActiveValidatorsCount: jest.fn(),
            getChurnLimit: jest.fn(),
            getFrameBalances: jest.fn(),
            getSweepMeanEpochs: jest.fn(),
            getLastUpdate: jest.fn(),
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
          provide: BlockStateCacheService,
          useValue: {
            getBlockState: jest.fn(),
          },
        },
        {
          provide: PrometheusService,
          useValue: {},
        },
      ],
    }).compile();

    service = moduleRef.get<WaitingTimeService>(WaitingTimeService);
    rewardsStorage = moduleRef.get<RewardsStorageService>(RewardsStorageService);
    contractConfig = moduleRef.get<ContractConfigStorageService>(ContractConfigStorageService);
    genesisTimeService = moduleRef.get<GenesisTimeService>(GenesisTimeService);
    validatorsStorage = moduleRef.get<ValidatorsStorageService>(ValidatorsStorageService);
    queueInfoStorageService = moduleRef.get<QueueInfoStorageService>(QueueInfoStorageService);

    // mocks
    jest.spyOn(contractConfig, 'getInitialEpoch').mockReturnValue(initialEpoch);
    jest.spyOn(contractConfig, 'getEpochsPerFrame').mockReturnValue(epochPerFrame);
    jest.spyOn(contractConfig, 'getMaxValidatorExitRequestsPerReport').mockReturnValue(600);
    jest.spyOn(contractConfig, 'getEpochsPerFrameVEBO').mockReturnValue(45);
    jest.spyOn(contractConfig, 'getRequestTimestampMargin').mockReturnValue(7680000);
    jest.spyOn(contractConfig, 'getLastUpdate').mockReturnValue(1);
    jest.spyOn(genesisTimeService, 'getCurrentEpoch').mockReturnValue(currentEpoch);
    jest.spyOn(genesisTimeService, 'getFrameOfEpoch').mockImplementation(getFrameOfEpochMock);
    jest.spyOn(genesisTimeService, 'getFrameByTimestamp').mockImplementation(getFrameByTimestampMock);
    jest.spyOn(genesisTimeService, 'timeToWithdrawalFrame').mockImplementation(timeToWithdrawalFrameMock);
    jest.spyOn(rewardsStorage, 'getRewardsPerFrame').mockReturnValue(rewardsPerFrame);
    jest.spyOn(validatorsStorage, 'getActiveValidatorsCount').mockReturnValue(10000);
    jest.spyOn(validatorsStorage, 'getFrameBalances').mockReturnValue({});
    jest.spyOn(validatorsStorage, 'getSweepMeanEpochs').mockReturnValue(1041);
    jest.spyOn(validatorsStorage, 'getChurnLimit').mockReturnValue(8);
    jest.spyOn(validatorsStorage, 'getLastUpdate').mockReturnValue(1);
    jest.spyOn(queueInfoStorageService, 'getRequests').mockReturnValue([]);
    jest.spyOn(queueInfoStorageService, 'getLastUpdate').mockReturnValue(1);
    jest.spyOn(service, 'getFrameIsBunker').mockReturnValue(null);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.resetAllMocks();
  });

  describe('check withdrawal calculation types', () => {
    it('returns initializing until contract-config is ready', () => {
      jest.spyOn(contractConfig, 'getLastUpdate').mockReturnValue(null);

      expect(service.checkIsInitializing()).toEqual({
        requestInfo: null,
        status: 'initializing',
        nextCalculationAt: null,
      });
    });

    it(`type buffer`, async () => {
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('1007748958196602737132'),
        buffer: BigNumber.from('1007748958196602737137'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.buffer);
    });

    it(`type requestTimestampMargin`, async () => {
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('1007748958196602737132'),
        buffer: BigNumber.from('1007748958196602737137'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: 1703687441739,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.requestTimestampMargin);
    });

    it(`type vaultsBalance`, async () => {
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('1007748958196602737138'),
        buffer: BigNumber.from('1007748958196602737137'),
        vaultsBalance: BigNumber.from('2'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.vaultsBalance);
    });

    it(`type exitValidators`, async () => {
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('10000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.exitValidators);
    });

    it(`uses current VEBO frame config in exit validator ETA`, async () => {
      jest.spyOn(validatorsStorage, 'getFrameBalances').mockReturnValue({});
      jest.spyOn(contractConfig, 'getEpochsPerFrameVEBO').mockReturnValue(75);

      const resultWith75EpochFrames = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('100000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      jest.spyOn(contractConfig, 'getEpochsPerFrameVEBO').mockReturnValue(45);

      const resultWith45EpochFrames = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('100000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(resultWith45EpochFrames.type).toBe(WaitingTimeCalculationType.exitValidators);
      expect(resultWith45EpochFrames.frame).toBeLessThan(resultWith75EpochFrames.frame);
    });
  });

  describe('calculates withdrawal type rewardsOnly', () => {
    it(`check type`, async () => {
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('1007748958196602737138'),
        buffer: BigNumber.from('1007748958196602737137'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.rewardsOnly);
    });

    it(`check frames number`, () => {
      const countFrames = 3;
      const expectedResult = getFrameOfEpochMock(currentEpoch) + countFrames + 1;
      const result = service.calculateFrameByRewardsOnly(BigNumber.from(rewardsPerFrame).mul(countFrames));

      expect(result).toBe(expectedResult);
    });
  });

  describe('calculates withdrawal type validatorBalances', () => {
    it(`is enough validators balances`, async () => {
      jest.spyOn(validatorsStorage, 'getFrameBalances').mockReturnValue(frameBalancesMock);
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('10000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.validatorBalances);
    });

    it(`is not enough validators balances, fallback to exitValidators`, async () => {
      jest.spyOn(validatorsStorage, 'getFrameBalances').mockReturnValue(frameBalancesMock);
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('100000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.exitValidators);
    });

    it(`is bunker active, return type bunker`, async () => {
      jest.spyOn(service, 'getFrameIsBunker').mockReturnValue(15);
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('100000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.type).toBe(WaitingTimeCalculationType.bunker);
    });

    it(`tests that resulted frame is not past`, async () => {
      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('1007748958196602737132'),
        buffer: BigNumber.from('1007748958196602737137'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(result.frame).toBeGreaterThan(getFrameOfEpochMock(currentEpoch));
    });
  });
});
