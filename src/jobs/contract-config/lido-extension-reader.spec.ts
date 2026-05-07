jest.mock('common/config', () => ({}));

import { LidoExtensionReader } from './lido-extension-reader';

const LIDO_ADDR = '0x3508a952176b3c15387c97be809eaffb1982176a';

const encodeUint256 = (v: number | bigint): string =>
  '0x' + (typeof v === 'bigint' ? v : BigInt(v)).toString(16).padStart(64, '0');

describe('LidoExtensionReader', () => {
  let reader: LidoExtensionReader;
  let provider: { call: jest.Mock };
  let contractLido: { address: string };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    provider = { call: jest.fn() };
    contractLido = { address: LIDO_ADDR };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    reader = new LidoExtensionReader(logger as any, provider as any, contractLido as any);
  });

  describe('probe', () => {
    it('returns true and latches when getDepositsReserve responds', async () => {
      provider.call.mockResolvedValue(encodeUint256(0)); // any successful response

      const supported = await reader.probe();

      expect(supported).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(
        'Lido SR-3 extension detected (getDepositsReserve supported)',
        expect.objectContaining({ lidoAddress: LIDO_ADDR }),
      );
    });

    it('returns false without latching when call reverts (pre-SR-3 contract)', async () => {
      provider.call.mockRejectedValue(new Error('execution reverted: unknown selector'));

      const supported = await reader.probe();

      expect(supported).toBe(false);
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('one-way latch: once true, stays true even if subsequent RPC fails', async () => {
      // first probe succeeds
      provider.call.mockResolvedValueOnce(encodeUint256(1234));
      const first = await reader.probe();
      expect(first).toBe(true);

      // simulate RPC outage on next tick — but latched, so no network call is made
      provider.call.mockRejectedValueOnce(new Error('network timeout'));
      const second = await reader.probe();

      expect(second).toBe(true);
      // the second probe() should not have hit the network
      expect(provider.call).toHaveBeenCalledTimes(1);
      // log fires exactly once, on the latch transition
      expect(logger.log).toHaveBeenCalledTimes(1);
    });

    it('does not latch on transient failure; will re-probe next tick', async () => {
      // first probe: transient network failure
      provider.call.mockRejectedValueOnce(new Error('econnrefused'));
      const first = await reader.probe();
      expect(first).toBe(false);

      // next tick: success — should now latch
      provider.call.mockResolvedValueOnce(encodeUint256(0));
      const second = await reader.probe();
      expect(second).toBe(true);
      expect(logger.log).toHaveBeenCalledTimes(1); // log fires only on the success transition
    });
  });

  describe('getDepositsReserveAt', () => {
    it('returns decoded uint256 at the given block', async () => {
      // 100 ETH deposits reserve = 100 * 10^18 wei
      const reserveWei = BigInt('100000000000000000000');
      provider.call.mockResolvedValue(encodeUint256(reserveWei));

      const result = await reader.getDepositsReserveAt(12_345_678);

      expect(result.toString()).toBe(reserveWei.toString());
      expect(provider.call).toHaveBeenCalledWith({ to: LIDO_ADDR, data: expect.any(String) }, 12_345_678);
    });

    it('returns 0 and logs warn on revert', async () => {
      provider.call.mockRejectedValue(new Error('execution reverted'));

      const result = await reader.getDepositsReserveAt(12_345_678);

      expect(result.toNumber()).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        'getDepositsReserveAt failed; falling back to 0 reserve',
        expect.objectContaining({
          lidoAddress: LIDO_ADDR,
          blockTag: 12_345_678,
          error: 'execution reverted',
        }),
      );
    });

    it('handles non-Error throw values (defensive String coercion)', async () => {
      provider.call.mockRejectedValue('plain string error');

      const result = await reader.getDepositsReserveAt(12_345_678);

      expect(result.toNumber()).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: 'plain string error' }),
      );
    });

    it('passes the data selector consistently across calls', async () => {
      provider.call.mockResolvedValue(encodeUint256(0));
      await reader.getDepositsReserveAt(100);
      await reader.getDepositsReserveAt(200);

      const firstCallArgs = provider.call.mock.calls[0];
      const secondCallArgs = provider.call.mock.calls[1];
      expect(firstCallArgs[0].data).toBe(secondCallArgs[0].data);
      expect(firstCallArgs[1]).toBe(100);
      expect(secondCallArgs[1]).toBe(200);
    });
  });

  describe('getDepositsReserveTargetAt', () => {
    it('returns decoded uint256 at the given block', async () => {
      // 5,000 ETH governance-set target = 5,000 × 10^18 wei
      const targetWei = BigInt('5000000000000000000000');
      provider.call.mockResolvedValue(encodeUint256(targetWei));

      const result = await reader.getDepositsReserveTargetAt(12_345_678);

      expect(result.toString()).toBe(targetWei.toString());
      expect(provider.call).toHaveBeenCalledWith({ to: LIDO_ADDR, data: expect.any(String) }, 12_345_678);
    });

    it('returns 0 and logs warn on revert (e.g. pre-SR-3 contract)', async () => {
      provider.call.mockRejectedValue(new Error('execution reverted'));

      const result = await reader.getDepositsReserveTargetAt(12_345_678);

      expect(result.toNumber()).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        'getDepositsReserveTargetAt failed; falling back to 0 target',
        expect.objectContaining({
          lidoAddress: LIDO_ADDR,
          blockTag: 12_345_678,
          error: 'execution reverted',
        }),
      );
    });

    it('uses a different selector than getDepositsReserveAt (sibling method, not alias)', async () => {
      provider.call.mockResolvedValue(encodeUint256(0));
      await reader.getDepositsReserveAt(100);
      await reader.getDepositsReserveTargetAt(100);

      const reserveSelector = provider.call.mock.calls[0][0].data;
      const targetSelector = provider.call.mock.calls[1][0].data;
      expect(reserveSelector).not.toBe(targetSelector);
    });
  });
});
