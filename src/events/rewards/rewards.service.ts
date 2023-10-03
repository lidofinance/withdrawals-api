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

const Interface = utils.Interface;

const getValue = (obj, key) => {
  return obj[key];
};

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
    if (rewardsPerFrame) {
      this.rewardsStorage.setRewardsPerFrame(rewardsPerFrame);
    }
  }

  public async getLastTotalRewardsPerFrame(): Promise<BigNumber | null> {
    const framesFromLastReport = await this.getFramesFromLastReport();
    if (framesFromLastReport === null) {
      return null;
    }

    const { blockNumber, frames } = framesFromLastReport;

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

  protected async getElRewards(fromBlock: number): Promise<BigNumber> {
    const res = this.contractLido.filters.ELRewardsReceived();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock,
      address: res.address,
    });
    const lastLog = logs[logs.length - 1];
    const parser = new Interface([LIDO_EL_REWARDS_RECEIVED_EVENT]);
    const parsedData = parser.parseLog(lastLog);
    return BigNumber.from(getValue(parsedData.args, 'amount'));
  }

  protected async getEthDistributed(fromBlock: number): Promise<{
    preCLBalance: BigNumber;
    postCLBalance: BigNumber;
  }> {
    const res = this.contractLido.filters.ETHDistributed();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock,
      address: res.address,
    });

    const lastLog = logs[logs.length - 1];
    const parser = new Interface([LIDO_ETH_DESTRIBUTED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    const preCLBalance = BigNumber.from(getValue(parsedData.args, 'preCLBalance'));
    const postCLBalance = BigNumber.from(getValue(parsedData.args, 'postCLBalance'));
    return { preCLBalance, postCLBalance };
  }

  protected async getWithdrawalsReceived(fromBlock: number): Promise<BigNumber> {
    const res = this.contractLido.filters.WithdrawalsReceived();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock,
      address: res.address,
    });

    const lastLog = logs[logs.length - 1];
    const parser = new Interface([LIDO_WITHDRAWALS_RECEIVED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    return BigNumber.from(getValue(parsedData.args, 'amount'));
  }

  // reports can be skipped, so we need timeElapsed (time from last report)
  protected async getFramesFromLastReport(): Promise<{
    blockNumber: number;
    frames: BigNumber;
  } | null> {
    const last48HoursAgoBlock = await this.get48HoursAgoBlock();

    const res = this.contractLido.filters.TokenRebased();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock: last48HoursAgoBlock,
      address: res.address,
    });

    if (logs.length === 0) {
      return null;
    }

    const lastLog = logs[logs.length - 1];
    const parser = new Interface([LIDO_TOKEN_REBASED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    return {
      blockNumber: lastLog.blockNumber,
      frames: BigNumber.from(getValue(parsedData.args, 'timeElapsed')).div(24 * 60 * 60),
    };
  }
}
