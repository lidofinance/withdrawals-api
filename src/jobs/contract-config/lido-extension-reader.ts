import { Inject, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { Interface, id } from 'ethers';
import { LIDO_CONTRACT_TOKEN, Lido } from '@lido-nestjs/contracts';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { LIDO_EXTENSION_ABI } from 'common/contracts/abi/lido-extension.abi';

const GET_DEPOSITS_RESERVE_SELECTOR = id('getDepositsReserve()').slice(0, 10);
const LIDO_EXTENSION_INTERFACE = new Interface(LIDO_EXTENSION_ABI);

/**
 * Probes the Lido proxy for SR-3 extension methods (specifically `getDepositsReserve()`)
 * and reads the deposits-reserve value at a given block. Lido is behind a stable proxy,
 * so address-as-trigger discrimination doesn't apply — we use method-existence probing.
 *
 * Once `getDepositsReserve()` is observed responding (post-SR-3), the in-memory latch flips
 * to `true` and never reverts. Defends against transient RPC failures masquerading as a
 * "pre-SR-3" signal — a protocol cannot un-deploy SR-3, so a one-way latch is correct.
 *
 * Two methods, used by different consumers:
 * - `probe()` — called by contract-config job once per tick to update the storage boolean.
 * - `getDepositsReserveAt(blockTag)` — called by BlockStateCacheService for the actual value
 *   at the same block where buffer was read.
 *
 * @see plans/2026-05-04-sr-3-readiness.md PR 3 commit 5
 * @see research/2026-05-04-validator-balance-above-32-eth.md (Finding 9)
 */
@Injectable()
export class LidoExtensionReader {
  static SERVICE_LOG_NAME = 'lido-extension-reader';

  private supportedLatched = false;

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
  ) {}

  /**
   * Returns `true` if `getDepositsReserve()` is present on the connected Lido contract.
   * Latches at `true` after the first successful observation; `false` is never cached.
   */
  public async probe(): Promise<boolean> {
    if (this.supportedLatched) {
      return true;
    }
    try {
      const lidoAddress = this.contractLido.address;
      await this.provider.call({ to: lidoAddress, data: GET_DEPOSITS_RESERVE_SELECTOR });
      this.supportedLatched = true;
      this.logger.log('Lido SR-3 extension detected (getDepositsReserve supported)', {
        service: LidoExtensionReader.SERVICE_LOG_NAME,
        lidoAddress,
      });
      return true;
    } catch {
      // pre-SR-3 contract reverts on unknown selector, OR a transient RPC failure.
      // Either way: don't latch — we'll re-probe next tick.
      return false;
    }
  }

  /**
   * Reads `getDepositsReserve()` at the given block. Caller is expected to gate this on the
   * latched/cached `supported` flag, but the method is defensive: on revert or RPC error it
   * returns `0` and logs at `warn` (the call is supposed to succeed once we've latched).
   */
  public async getDepositsReserveAt(blockTag: number): Promise<BigNumber> {
    const lidoAddress = this.contractLido.address;
    try {
      const data = await this.provider.call(
        { to: lidoAddress, data: GET_DEPOSITS_RESERVE_SELECTOR },
        blockTag,
      );
      const [reserve] = LIDO_EXTENSION_INTERFACE.decodeFunctionResult('getDepositsReserve', data);
      return BigNumber.from(reserve.toString());
    } catch (error: unknown) {
      this.logger.warn('getDepositsReserveAt failed; falling back to 0 reserve', {
        service: LidoExtensionReader.SERVICE_LOG_NAME,
        lidoAddress,
        blockTag,
        error: error instanceof Error ? error.message : String(error),
      });
      return BigNumber.from(0);
    }
  }
}
