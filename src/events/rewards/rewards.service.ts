import { Inject, Injectable } from '@nestjs/common';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from '../../common/genesis-time';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import {
  Lido,
  LIDO_CONTRACT_TOKEN,
  EXECUTION_REWARDS_VAULT_CONTRACT_ADDRESSES,
  LIDO_LOCATOR_CONTRACT_TOKEN,
  LidoLocator,
} from '@lido-nestjs/contracts';
import { Interface } from 'ethers';
import {
  LIDO_EL_REWARDS_RECEIVED_EVENT,
  LIDO_ETH_DESTRIBUTED_EVENT,
  LIDO_TOKEN_REBASED_EVENT,
  LIDO_WITHDRAWALS_RECEIVED_EVENT,
} from './rewards.constants';
import { BigNumber } from '@ethersproject/bignumber';
import { LOGGER_PROVIDER, LoggerService } from '../../common/logger';
import { ConfigService } from '../../common/config';
import { ContractConfigStorageService, RewardsStorageService } from '../../storage';

@Injectable()
export class RewardsService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,
    protected readonly rewardsStorage: RewardsStorageService,
    protected readonly contractConfig: ContractConfigStorageService,
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

    if (!rewardsPerFrame) {
      return;
    }

    this.rewardsStorage.setRewardsPerFrame(rewardsPerFrame.allRewards);
    this.rewardsStorage.setClRewardsPerFrame(rewardsPerFrame.clRewards);
    this.rewardsStorage.setElRewardsPerFrame(rewardsPerFrame.elRewards);
  }

  public async getLastTotalRewardsPerFrame(): Promise<{
    clRewards: BigNumber;
    elRewards: BigNumber;
    allRewards: BigNumber;
  } | null> {
    const framesFromLastReport = await this.getFramesFromLastReport();
    if (framesFromLastReport === null) {
      return null;
    }

    const { blockNumber, frames } = framesFromLastReport;

    if (frames.eq(0)) {
      return {
        clRewards: BigNumber.from(0),
        elRewards: BigNumber.from(0),
        allRewards: BigNumber.from(0),
      };
    }

    const { preCLBalance, postCLBalance } = await this.getEthDistributed(blockNumber);
    const elRewards = (await this.getElRewards(blockNumber)) ?? BigNumber.from(0);
    const withdrawalsReceived = (await this.getWithdrawalsReceived(blockNumber)) ?? BigNumber.from(0);

    const clValidatorsBalanceDiff = postCLBalance.sub(preCLBalance);
    const clRewards = clValidatorsBalanceDiff.add(withdrawalsReceived);

    return {
      clRewards: clRewards.div(frames),
      elRewards: elRewards.div(frames),
      allRewards: clRewards.add(elRewards).div(frames),
    };
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

    if (!lastLog) {
      return BigNumber.from(0);
    }

    // check testnet error, not found events rewards
    const parser = new Interface([LIDO_EL_REWARDS_RECEIVED_EVENT]);
    const parsedData = parser.parseLog(lastLog);
    return BigNumber.from(parsedData.args.getValue('amount'));
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

    if (!lastLog) {
      this.logger.warn('ETHDistributed event is not found for CL balance.');

      // if balances is not found leave them empty and so diff CL (which is CL rewards) will be 0
      return {
        preCLBalance: BigNumber.from(0),
        postCLBalance: BigNumber.from(0),
      };
    }
    const parser = new Interface([LIDO_ETH_DESTRIBUTED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    const preCLBalance = BigNumber.from(parsedData.args.getValue('preCLBalance'));
    const postCLBalance = BigNumber.from(parsedData.args.getValue('postCLBalance'));
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
    if (!lastLog) {
      return BigNumber.from(0);
    }
    const parser = new Interface([LIDO_WITHDRAWALS_RECEIVED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    return BigNumber.from(parsedData.args.getValue('amount'));
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
      frames: BigNumber.from(parsedData.args.getValue('timeElapsed')).div(
        SECONDS_PER_SLOT * SLOTS_PER_EPOCH * this.contractConfig.getEpochsPerFrame(),
      ),
    };
  }

  // it includes WithdrawalVault balance and diff between rewards and cached rewards from previous report
  async getVaultsBalance() {
    const chainId = this.configService.get('CHAIN_ID');
    const withdrawalVaultAddress = await this.lidoLocator.withdrawalVault();
    const withdrawalVaultBalance = await this.provider.getBalance(withdrawalVaultAddress);
    const rewardsVaultBalance = await this.provider.getBalance(EXECUTION_REWARDS_VAULT_CONTRACT_ADDRESSES[chainId]);
    const elRewards = this.rewardsStorage.getElRewardsPerFrame();
    const clRewards = this.rewardsStorage.getClRewardsPerFrame();

    // note: it is pessimistic, we can sub rewards partially depending on amount of time past
    const diffCl = withdrawalVaultBalance.sub(clRewards);
    const diffEl = rewardsVaultBalance.sub(elRewards);

    let balance = BigNumber.from(0);

    if (diffEl.gt(0)) {
      balance = balance.add(diffEl);
    }

    if (diffCl.gt(0)) {
      balance = balance.add(diffCl);
    }

    return balance;
  }
}
