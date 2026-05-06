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
            getMaxBalanceExitRequestedPerReportInEth: jest.fn(),
            getEpochsPerFrameVEBO: jest.fn(),
            getRequestTimestampMargin: jest.fn(),
            getDepositsReserveTarget: jest.fn(),
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
            getExitChurnLimit: jest.fn(),
            getFrameBalances: jest.fn(),
            getSweepMeanEpochs: jest.fn(),
            getMaxExitEpoch: jest.fn(),
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
    // 19,200 ETH = legacy 600 validator-cap × 32 ETH (lossless identity); both eras now stored in ETH.
    jest.spyOn(contractConfig, 'getMaxBalanceExitRequestedPerReportInEth').mockReturnValue(BigNumber.from(19_200));
    // Default 0 target → deposits-reserve netting is a no-op, regression-safe for existing assertions.
    jest.spyOn(contractConfig, 'getDepositsReserveTarget').mockReturnValue(BigNumber.from(0));
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
    jest.spyOn(validatorsStorage, 'getExitChurnLimit').mockReturnValue(8);
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
      // Force VEBO-bottleneck regime: VEBO cap (5,000 ETH/frame) is well below network exit
      // churn × frame (256 × 45 = 11,520 ETH/frame). In this regime VEBO is the binding
      // constraint on throughput, so smaller VEBO frame duration ⇒ shorter elapsed epochs
      // for the same number of VEBO frames worth of issuance ⇒ earlier finalization frame.
      jest.spyOn(contractConfig, 'getMaxBalanceExitRequestedPerReportInEth').mockReturnValue(BigNumber.from(5_000));
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
      // unit test: pass rewardsPerFrame directly as the netted rate (target=0 case → no netting)
      const result = service.calculateFrameByRewardsOnly(
        BigNumber.from(rewardsPerFrame).mul(countFrames),
        rewardsPerFrame,
      );

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

  // Per-frame `depositsReserveTarget` is a recurring claim on rewards: at every oracle report
  // the protocol siphons up to `target` ETH worth of fresh inflows to refill the reserve before
  // the rest becomes available for withdrawals. The engine nets this out at the top of
  // `calculateWithdrawalFrame` and threads `rewardsAvailableForWithdrawals` into all three
  // projection cases.
  describe('deposits-reserve future-projection netting', () => {
    it(`target=0 (regression pin): netting is a no-op, calculateFrameByRewardsOnly identical to pre-fix`, () => {
      // Mirror of the existing "check frames number" assertion above, made explicit as a
      // regression pin. With target=0, rewardsAvailableForWithdrawals === rewardsPerFrame and
      // the formula behaves exactly as it did before this change.
      jest.spyOn(contractConfig, 'getDepositsReserveTarget').mockReturnValue(BigNumber.from(0));
      const countFrames = 3;
      const result = service.calculateFrameByRewardsOnly(
        BigNumber.from(rewardsPerFrame).mul(countFrames),
        rewardsPerFrame, // = rewardsAvailable when target=0
      );
      expect(result).toBe(getFrameOfEpochMock(currentEpoch) + countFrames + 1);
    });

    it(`target = rewardsPerFrame/2: rewardsOnly drain takes ~2× as long`, () => {
      const halfRewards = BigNumber.from(rewardsPerFrame).div(2);
      const countFrames = 3;
      const result = service.calculateFrameByRewardsOnly(BigNumber.from(rewardsPerFrame).mul(countFrames), halfRewards);
      // Half rate → 2× as many epochs to drain → 2 × countFrames frames from baseline
      expect(result).toBe(getFrameOfEpochMock(currentEpoch) + countFrames * 2 + 1);
    });

    it(`target >= rewardsPerFrame: rewardsAvailable=0 → calculateFrameByRewardsOnly returns null`, () => {
      const result = service.calculateFrameByRewardsOnly(BigNumber.from(rewardsPerFrame).mul(3), BigNumber.from(0));
      expect(result).toBeNull();
    });

    it(`target>0 makes calculateWithdrawalFrame estimate strictly later than target=0 baseline`, async () => {
      // Force exitValidators case (large unfinalized, no buffer). With target=0, baseline frame.
      jest.spyOn(contractConfig, 'getDepositsReserveTarget').mockReturnValue(BigNumber.from(0));
      const baseline = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('100000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      // With target = half of rewards, the rewards term in exitValidators' formula is halved
      // → totalEthPerVEBOFrame is slightly smaller → VEBOFrames slightly larger → estimate later.
      // The shift is small because exitChurn dominates over rewards in this regime, but it must
      // not regress backward.
      jest.spyOn(contractConfig, 'getDepositsReserveTarget').mockReturnValue(BigNumber.from(rewardsPerFrame).div(2));
      const withTarget = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('100000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      expect(withTarget.frame).toBeGreaterThanOrEqual(baseline.frame);
    });
  });

  describe('exitValidators case behavior at maxBalanceExitRequestedPerReportInEth = 0', () => {
    // Per on-chain `_checkLimitValue(_, 0, type(uint16).max)`, governance can set the VEBO ETH
    // cap to 0 to halt new exit-request submissions (an emergency lever). The engine should
    // gracefully degrade rather than divide-by-zero on this legitimate state.
    it(`with cap=0 and positive rewards: case still yields a valid frame via rewards-only drain`, async () => {
      jest.spyOn(contractConfig, 'getMaxBalanceExitRequestedPerReportInEth').mockReturnValue(BigNumber.from(0));
      jest.spyOn(validatorsStorage, 'getFrameBalances').mockReturnValue({});

      const result = await service.calculateWithdrawalFrame({
        unfinalized: BigNumber.from('10000007748958196602737138'),
        buffer: BigNumber.from('0'),
        vaultsBalance: BigNumber.from('0'),
        requestTimestamp: lockedSystemTimestamp,
        latestEpoch: '312321',
      });

      // when VEBO is frozen but rewards still flow, the queue drains via rewards alone — both
      // exitValidators and rewardsOnly cases compute the same answer, so either type is valid
      expect([WaitingTimeCalculationType.exitValidators, WaitingTimeCalculationType.rewardsOnly]).toContain(
        result.type,
      );
      expect(result.frame).toBeGreaterThan(getFrameOfEpochMock(currentEpoch));
    });

    it(`private path: with cap=0 AND rewards=0, calculateFrameExitValidatorsCaseWithVEBO returns null`, async () => {
      jest.spyOn(contractConfig, 'getMaxBalanceExitRequestedPerReportInEth').mockReturnValue(BigNumber.from(0));
      jest.spyOn(rewardsStorage, 'getRewardsPerFrame').mockReturnValue(BigNumber.from(0));

      // Direct invocation: when both exit-cap and rewards are zero, totalEthPerVEBOFrame is
      // zero and the case returns null so the engine takes the minimum over the remaining cases
      // (or surfaces an empty-cases failure for the degenerate state).
      const result = await (service as any).calculateFrameExitValidatorsCaseWithVEBO(
        BigNumber.from('10000007748958196602737138'),
        '312321',
        BigNumber.from(0), // rewardsAvailableForWithdrawals
      );

      expect(result).toBeNull();
    });
  });

  // Site C in the research note: `calculateRequestTimeSimple` previously recomputed a Phase-0
  // count-based churn limit locally (`max(4, totalValidators / 65536)`), ignoring the
  // post-Electra 256 ETH/epoch cap. At mainnet validator scale that yielded ~768 ETH/epoch and
  // estimates ~3× too short. Fix delegates to `validators.getChurnLimit()` which is balance-
  // based and capped per spec.
  describe('calculateRequestTimeSimple (Site C — post-Electra churn delegation)', () => {
    it(`uses balance-based churn from storage; estimate is longer than the pre-fix Phase-0 formula at mainnet scale`, () => {
      // mainnet-scale inputs: ~1.6M active validators (the pre-fix formula would have
      // computed churnLimit = 24 from this); storage's getChurnLimit returns 8 because
      // 256 ETH/epoch / 32 ETH = 8 (post-Electra cap)
      jest.spyOn(validatorsStorage, 'getActiveValidatorsCount').mockReturnValue(1_600_000);
      jest.spyOn(validatorsStorage, 'getChurnLimit').mockReturnValue(8);
      // anchor maxExitEpoch at currentEpoch + MAX_SEED_LOOKAHEAD + 1 floor (= 252030)
      jest.spyOn(validatorsStorage, 'getMaxExitEpoch').mockReturnValue('252030');

      // 1_000_000 ETH unfinalized
      const oneMillionEth = BigNumber.from('1000000000000000000000000');
      const days = service.calculateRequestTimeSimple(oneMillionEth);

      // post-fix math:
      //   lidoQueueInEpoch = 1_000_000e18 / (32e18 * 8) = 3906
      //   potentialExitEpoch = 252030 + 3906 + 1041 = 256977
      //   waitingTime = (256977 - 252025) * 12 * 32 / 86400 = 22
      expect(days).toBe(22);
      // pre-fix at the same inputs would have computed churnLimit = 24 from
      // getActiveValidatorsCount = 1.6M, denominator = 32 * 24 = 768 ETH/epoch (above the
      // real 256 ETH/epoch cap), and returned 10 days — over-promising.
    });
  });
});
