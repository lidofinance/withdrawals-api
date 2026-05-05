import { Inject, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { LIDO_CONTRACT_TOKEN, Lido, WITHDRAWAL_QUEUE_CONTRACT_TOKEN, WithdrawalQueue } from '@lido-nestjs/contracts';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ContractConfigStorageService } from 'storage';
import { RewardsService } from 'events/rewards';
import { GenesisTimeService, SECONDS_PER_SLOT } from 'common/genesis-time';
import { OracleV2__factory } from '../common/contracts/generated';
import { LidoExtensionReader } from '../jobs/contract-config/lido-extension-reader';

export interface BlockState {
  blockNumber: number;
  unfinalized: BigNumber;
  buffer: BigNumber;
  vaultsBalance: BigNumber;
}

@Injectable()
export class BlockStateCacheService {
  private static readonly BLOCK_NUMBER_TTL_MS = SECONDS_PER_SLOT * 1000;

  private cachedBlockNumber: number | null = null;
  private blockNumberCachedAt: number | null = null;
  private stateCache: BlockState | null = null;

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contractWithdrawal: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly contractConfig: ContractConfigStorageService,
    protected readonly rewardsService: RewardsService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly lidoExtensionReader: LidoExtensionReader,
  ) {}

  async getBlockState(): Promise<BlockState> {
    const blockNumber = await this.getOrFetchBlockNumber();

    if (this.stateCache?.blockNumber === blockNumber) {
      return this.stateCache;
    }

    // On post-SR-3 Lido `getBufferedEther()` returns the total buffer, but only
    // `total - depositsReserve` is actually drainable to withdrawals — the deposits-reserve
    // bucket is protected. Pre-SR-3 Lido has no such concept; we read 0 in that branch and
    // the subtraction is a no-op.
    const depositsReservePromise = this.contractConfig.getLidoSupportsDepositsReserve()
      ? this.lidoExtensionReader.getDepositsReserveAt(blockNumber)
      : Promise.resolve(BigNumber.from(0));

    const [unfinalized, totalBuffer, vaultsBalance, depositsReserve] = await Promise.all([
      this.contractWithdrawal.unfinalizedStETH({ blockTag: blockNumber }),
      this.contractLido.getBufferedEther({ blockTag: blockNumber }),
      this.rewardsService.getVaultsBalance(blockNumber),
      depositsReservePromise,
    ]);

    // Defensive clamp: if depositsReserve somehow exceeds totalBuffer (shouldn't happen per
    // contract invariants — Lido's _getBufferedEtherAllocation caps reserve at total — but
    // an edge case at upgrade boundaries could surface), saturate at 0 instead of underflow.
    const buffer = totalBuffer.gt(depositsReserve) ? totalBuffer.sub(depositsReserve) : BigNumber.from(0);

    this.stateCache = { blockNumber, unfinalized, buffer, vaultsBalance };
    return this.stateCache;
  }

  private async getOrFetchBlockNumber(): Promise<number> {
    const now = Date.now();
    if (
      this.cachedBlockNumber !== null &&
      this.blockNumberCachedAt !== null &&
      now - this.blockNumberCachedAt < BlockStateCacheService.BLOCK_NUMBER_TTL_MS
    ) {
      return this.cachedBlockNumber;
    }

    const blockNumber = await this.resolveBlockNumber();
    this.cachedBlockNumber = blockNumber;
    this.blockNumberCachedAt = now;
    return blockNumber;
  }

  private async resolveBlockNumber(): Promise<number> {
    const address = this.contractConfig.getAccountingOracleAddress();
    const accountingOracle = OracleV2__factory.connect(address, { provider: this.provider as any });
    const blockNumber = await this.provider.getBlockNumber();
    const processingState = await accountingOracle.getProcessingState({ blockTag: blockNumber });

    if (processingState.dataSubmitted) {
      this.logger.debug(`using latest block ${blockNumber}`);
      return blockNumber;
    }

    try {
      const currentFrameRefSlot = Number(processingState.currentFrameRefSlot);
      const processingRefBlockNumber = await this.genesisTimeService.getBlockBySlot(currentFrameRefSlot);
      this.logger.debug(`using processing ref slot of block ${processingRefBlockNumber}`);
      return processingRefBlockNumber;
    } catch (e) {
      this.logger.error(e);
      this.logger.warn(
        `using fallback latest block ${blockNumber} because failed ref slot ${processingState.currentFrameRefSlot}`,
      );
      return blockNumber;
    }
  }
}
