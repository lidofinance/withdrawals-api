jest.mock('common/config', () => ({}));

import { BigNumber } from '@ethersproject/bignumber';
import { BlockStateCacheService } from './block-state-cache.service';

const E18 = (n: number | string) => BigNumber.from(n).mul(BigNumber.from(10).pow(18));

describe('BlockStateCacheService — depositsReserve handling', () => {
  let service: BlockStateCacheService;
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };
  let contractWithdrawal: { unfinalizedStETH: jest.Mock };
  let contractLido: { getBufferedEther: jest.Mock };
  let provider: { getBlockNumber: jest.Mock };
  let contractConfig: {
    getAccountingOracleAddress: jest.Mock;
    getLidoSupportsDepositsReserve: jest.Mock;
  };
  let rewardsService: { getVaultsBalance: jest.Mock };
  let genesisTimeService: object;
  let lidoExtensionReader: { getDepositsReserveAt: jest.Mock };

  const blockNumber = 12_345_678;

  beforeEach(() => {
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    contractWithdrawal = { unfinalizedStETH: jest.fn().mockResolvedValue(E18(100)) };
    contractLido = { getBufferedEther: jest.fn().mockResolvedValue(E18(1_000)) };
    provider = { getBlockNumber: jest.fn() };
    contractConfig = {
      getAccountingOracleAddress: jest.fn(),
      getLidoSupportsDepositsReserve: jest.fn(),
    };
    rewardsService = { getVaultsBalance: jest.fn().mockResolvedValue(E18(50)) };
    genesisTimeService = { getSecondsPerSlot: jest.fn().mockReturnValue(12) };
    lidoExtensionReader = { getDepositsReserveAt: jest.fn() };

    service = new BlockStateCacheService(
      logger as any,
      contractWithdrawal as any,
      contractLido as any,
      provider as any,
      contractConfig as any,
      rewardsService as any,
      genesisTimeService as any,
      lidoExtensionReader as any,
    );

    // bypass resolveBlockNumber by pre-seeding the cached block
    (service as any).cachedBlockNumber = blockNumber;
    (service as any).blockNumberCachedAt = Date.now();
  });

  describe('pre-SR-3 mode (lidoSupportsDepositsReserve = false)', () => {
    beforeEach(() => {
      contractConfig.getLidoSupportsDepositsReserve.mockReturnValue(false);
    });

    it('does not query LidoExtensionReader', async () => {
      await service.getBlockState();

      expect(lidoExtensionReader.getDepositsReserveAt).not.toHaveBeenCalled();
    });

    it('returns full buffer as available (no subtraction)', async () => {
      const state = await service.getBlockState();

      expect(state.buffer.toString()).toBe(E18(1_000).toString());
    });
  });

  describe('post-SR-3 mode (lidoSupportsDepositsReserve = true)', () => {
    beforeEach(() => {
      contractConfig.getLidoSupportsDepositsReserve.mockReturnValue(true);
    });

    it('queries LidoExtensionReader at the same block as buffer', async () => {
      lidoExtensionReader.getDepositsReserveAt.mockResolvedValue(E18(200));

      await service.getBlockState();

      expect(lidoExtensionReader.getDepositsReserveAt).toHaveBeenCalledWith(blockNumber);
    });

    it('subtracts depositsReserve from totalBuffer to expose only the withdrawal-available portion', async () => {
      lidoExtensionReader.getDepositsReserveAt.mockResolvedValue(E18(200));

      const state = await service.getBlockState();

      // 1000 ETH total - 200 ETH reserved for deposits = 800 ETH available for withdrawals
      expect(state.buffer.toString()).toBe(E18(800).toString());
    });

    it('clamps to zero when depositsReserve >= totalBuffer (defensive against contract invariant violations)', async () => {
      lidoExtensionReader.getDepositsReserveAt.mockResolvedValue(E18(1_500));

      const state = await service.getBlockState();

      expect(state.buffer.toString()).toBe('0');
    });

    it('treats zero depositsReserve as a no-op (steady-state pre-migration governance choice)', async () => {
      lidoExtensionReader.getDepositsReserveAt.mockResolvedValue(BigNumber.from(0));

      const state = await service.getBlockState();

      expect(state.buffer.toString()).toBe(E18(1_000).toString());
    });
  });

  it('caches per block: identical block returns cached state without re-fetching', async () => {
    contractConfig.getLidoSupportsDepositsReserve.mockReturnValue(true);
    lidoExtensionReader.getDepositsReserveAt.mockResolvedValue(E18(50));

    await service.getBlockState();
    await service.getBlockState();
    await service.getBlockState();

    expect(contractLido.getBufferedEther).toHaveBeenCalledTimes(1);
    expect(lidoExtensionReader.getDepositsReserveAt).toHaveBeenCalledTimes(1);
  });
});
