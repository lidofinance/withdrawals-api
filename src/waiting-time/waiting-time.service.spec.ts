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
import { LIDO_CONTRACT_TOKEN, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { GenesisTimeService } from 'common/genesis-time/genesis-time.service';
import { RewardEventsService } from 'events/reward-events/reward-events.service';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';

import { WaitingTimeCalculationType } from './waiting-time.types';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { PrometheusService } from '../common/prometheus';

jest.mock('common/config', () => ({}));

describe('WaitingTimeService', () => {
  let moduleRef: TestingModule;
  let service: WaitingTimeService;
  let rewardsStorage: RewardsStorageService;
  let contractConfig: ContractConfigStorageService;
  let genesisTimeService: GenesisTimeService;
  let validatorsStorage: ValidatorsStorageService;
  let prometheusService: PrometheusService;
  let rpcBatchProvider: SimpleFallbackJsonRpcBatchProvider;

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
          },
        },
        {
          provide: WITHDRAWAL_QUEUE_CONTRACT_TOKEN,
          useValue: {
            unfinalizedStETH: jest.fn(),
            isBunkerModeActive: jest.fn(),
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
            getActiveValidatorsCount: jest.fn(),
            getChurnLimit: jest.fn(),
            getFrameBalances: jest.fn(),
            getSweepMeanEpochs: jest.fn(),
          },
        },
        {
          provide: SimpleFallbackJsonRpcBatchProvider,
          useValue: {
            getBlock: jest.fn(),
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
          provide: RewardEventsService,
          useValue: {},
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
    rpcBatchProvider = moduleRef.get<SimpleFallbackJsonRpcBatchProvider>(SimpleFallbackJsonRpcBatchProvider);
    prometheusService = moduleRef.get<PrometheusService>(PrometheusService);

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
    jest.spyOn(validatorsStorage, 'getActiveValidatorsCount').mockReturnValue(10000);
    jest.spyOn(validatorsStorage, 'getFrameBalances').mockReturnValue({});
    jest.spyOn(validatorsStorage, 'getSweepMeanEpochs').mockReturnValue(1041);
    jest.spyOn(validatorsStorage, 'getChurnLimit').mockReturnValue(8);
    jest.spyOn(service, 'getFrameIsBunker').mockReturnValue(null);
    // needed for mock only block number
    jest.spyOn(rpcBatchProvider, 'getBlock').mockResolvedValue({ number: 21367114 } as any);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.resetAllMocks();
  });

  describe('check withdrawal calculation types', () => {
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
      jest.spyOn(service, 'getFrameIsBunker').mockResolvedValue(15);
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
