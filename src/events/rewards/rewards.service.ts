import { Inject, Injectable } from '@nestjs/common';
import { SECONDS_PER_SLOT } from '../../common/genesis-time';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { Lido, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { utils } from 'ethers';
import {
  LIDO_EL_REWARDS_RECEIVED_EVENT,
  LIDO_ETH_DESTRIBUTED_EVENT,
  LIDO_TOKEN_REBASED_EVENT,
  LIDO_WITHDRAWALS_RECEIVED_EVENT,
} from './rewards.constants';
import { BigNumber } from '@ethersproject/bignumber';
import { LOGGER_PROVIDER, LoggerService } from '../../common/logger';
import { ConfigService } from '../../common/config';
import { RewardsStorageService } from '../../storage';

@Injectable()
export class RewardsService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    protected readonly rewardsStorage: RewardsStorageService,
    protected readonly configService: ConfigService,
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    await this.updateRewards();

    // getting total rewards per frame starts from TokenRebased event because it contains
    // how much time is gone from last report (can be more the 1-day in rare critical situation)
    const tokenRebased = this.contractLido.filters.TokenRebased();
    this.provider.on(tokenRebased, () => {
      this.logger.debug('event TokenRebased triggered');
      this.updateRewards();
    });
    this.logger.log('Service initialized', { service: 'rewards event' });
  }

  protected async updateRewards(): Promise<void> {
    const rewardsPerFrame = await this.getLastTotalRewardsPerFrame();
    this.rewardsStorage.setRewardsPerFrame(rewardsPerFrame);
  }

  public async getLastTotalRewardsPerFrame() {
    const { blockNumber, frames } = await this.getFramesFromLastReport();
    const { preCLBalance, postCLBalance } = await this.getEthDistributed(blockNumber);
    const elRewards = (await this.getElRewards(blockNumber)) ?? BigNumber.from(0);
    const withdrawal = (await this.getWithdrawalsReceived(blockNumber)) ?? BigNumber.from(0);

    const clValidatorsBalanceDiff = postCLBalance.sub(preCLBalance);
    const withdrawalsReceived = withdrawal ?? BigNumber.from(0);
    const clRewards = clValidatorsBalanceDiff.add(withdrawalsReceived);

    return clRewards.add(elRewards).div(frames);
  }

  protected async get48HoursAgoBlock() {
    const currentBlock = await this.provider.getBlockNumber();
    return currentBlock - Math.ceil((2 * 24 * 60 * 60) / SECONDS_PER_SLOT);
  }

  protected async getElRewards(fromBlock: number) {
    const res = this.contractLido.filters.ELRewardsReceived();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock,
      address: res.address,
    });
    const lastLog = logs[logs.length - 1];
    const parser = new utils.Interface([LIDO_EL_REWARDS_RECEIVED_EVENT]);
    const parsedData = parser.parseLog(lastLog);
    return parsedData.args.amount as BigNumber;
  }

  protected async getEthDistributed(fromBlock: number) {
    const res = this.contractLido.filters.ETHDistributed();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock,
      address: res.address,
    });

    const lastLog = logs[logs.length - 1];
    const parser = new utils.Interface([LIDO_ETH_DESTRIBUTED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    const { preCLBalance, postCLBalance } = parsedData.args;
    return { preCLBalance, postCLBalance, blockNumber: lastLog.blockNumber } as {
      preCLBalance: BigNumber;
      postCLBalance: BigNumber;
      blockNumber: number;
    };
  }

  protected async getWithdrawalsReceived(fromBlock: number) {
    const res = this.contractLido.filters.WithdrawalsReceived();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock,
      address: res.address,
    });

    const lastLog = logs[logs.length - 1];
    const parser = new utils.Interface([LIDO_WITHDRAWALS_RECEIVED_EVENT]);
    const parsedData = parser.parseLog(lastLog);
    return parsedData.args.amount as BigNumber;
  }

  // reports can be skipped, so we need timeElapsed (time from last report)
  protected async getFramesFromLastReport() {
    const last48HoursAgoBlock = await this.get48HoursAgoBlock();

    const res = this.contractLido.filters.TokenRebased();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock: last48HoursAgoBlock,
      address: res.address,
    });

    const lastLog = logs[logs.length - 1];
    const parser = new utils.Interface([LIDO_TOKEN_REBASED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    return {
      blockNumber: lastLog.blockNumber,
      frames: parsedData.args.timeElapsed.div(24 * 60 * 60),
    } as {
      blockNumber: number;
      frames: BigNumber;
    };
  }
}