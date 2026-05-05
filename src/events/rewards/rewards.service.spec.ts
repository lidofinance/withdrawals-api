import { BigNumber } from '@ethersproject/bignumber';
import { RewardsService } from './rewards.service';

jest.mock('common/config', () => ({}));

describe('RewardsService.getMinLastTotalRewardsPerFrame', () => {
  let service: RewardsService;

  beforeEach(() => {
    service = new RewardsService(
      { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('returns the minimum of CL and EL rewards across the last week (pessimistic projection)', async () => {
    // Three reports across the week: CL drops, spikes, drops again; EL drops, spikes, drops again.
    // The pessimistic (= safer for users, longer estimate) choice is the minimum of each axis,
    // which can land on different reports for CL vs EL.
    const reports = [
      { blockNumber: 1, frames: BigNumber.from(1) },
      { blockNumber: 2, frames: BigNumber.from(1) },
      { blockNumber: 3, frames: BigNumber.from(1) },
    ];
    const perBlockRewards: Record<number, { clRewards: BigNumber; elRewards: BigNumber }> = {
      1: { clRewards: BigNumber.from(5), elRewards: BigNumber.from(50) },
      2: { clRewards: BigNumber.from(100), elRewards: BigNumber.from(100) },
      3: { clRewards: BigNumber.from(3), elRewards: BigNumber.from(30) },
    };

    jest.spyOn(service as any, 'getFramesFromLastReports').mockResolvedValue(reports);
    jest
      .spyOn(service as any, 'getRewardsByBlockNumber')
      .mockImplementation(async (blockNumber: number) => perBlockRewards[blockNumber]);

    const result = await service.getMinLastTotalRewardsPerFrame();

    expect(result).not.toBeNull();
    expect(result.clRewards.toString()).toBe('3');
    expect(result.elRewards.toString()).toBe('30');
    expect(result.allRewards.toString()).toBe('33');
  });

  it('returns the minimum even when a single report dominates both axes', async () => {
    const reports = [
      { blockNumber: 1, frames: BigNumber.from(1) },
      { blockNumber: 2, frames: BigNumber.from(1) },
    ];
    const perBlockRewards: Record<number, { clRewards: BigNumber; elRewards: BigNumber }> = {
      1: { clRewards: BigNumber.from(10), elRewards: BigNumber.from(20) },
      2: { clRewards: BigNumber.from(1000), elRewards: BigNumber.from(2000) },
    };

    jest.spyOn(service as any, 'getFramesFromLastReports').mockResolvedValue(reports);
    jest
      .spyOn(service as any, 'getRewardsByBlockNumber')
      .mockImplementation(async (blockNumber: number) => perBlockRewards[blockNumber]);

    const result = await service.getMinLastTotalRewardsPerFrame();

    expect(result.clRewards.toString()).toBe('10');
    expect(result.elRewards.toString()).toBe('20');
    expect(result.allRewards.toString()).toBe('30');
  });

  it('returns zeros when no TokenRebased reports are found', async () => {
    jest.spyOn(service as any, 'getFramesFromLastReports').mockResolvedValue(null);

    const result = await service.getMinLastTotalRewardsPerFrame();

    expect(result.clRewards.toString()).toBe('0');
    expect(result.elRewards.toString()).toBe('0');
    expect(result.allRewards.toString()).toBe('0');
  });
});
