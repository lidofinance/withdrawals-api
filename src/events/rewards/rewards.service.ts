import { Inject, Injectable } from '@nestjs/common';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from '../../common/genesis-time';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { Lido, LIDO_CONTRACT_TOKEN, LIDO_LOCATOR_CONTRACT_TOKEN, LidoLocator } from '@lido-nestjs/contracts';
import { Interface } from 'ethers';
import {
  LIDO_EL_REWARDS_RECEIVED_EVENT,
  LIDO_ETH_DESTRIBUTED_EVENT,
  LIDO_TOKEN_REBASED_EVENT,
  LIDO_WITHDRAWALS_RECEIVED_EVENT,
  ONE_WEEK_HOURS,
} from './rewards.constants';
import { BigNumber } from '@ethersproject/bignumber';
import { LOGGER_PROVIDER, LoggerService } from '../../common/logger';
import { ConfigService } from '../../common/config';
import { ContractConfigStorageService, RewardsStorageService } from '../../storage';
import { PrometheusService } from '../../common/prometheus';

import { getLogsByRetryCount } from './rewards.utils';

@Injectable()
export class RewardsService {
  static SERVICE_LOG_NAME = 'rewards';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,
    protected readonly prometheusService: PrometheusService,
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
    this.provider.on(tokenRebased, async () => {
      this.logger.log('event TokenRebased triggered', { service: RewardsService.SERVICE_LOG_NAME });
      try {
        await this.updateRewards();
        this.prometheusService.rewardsEventTriggered.labels({ result: 'success' });
      } catch (e) {
        this.logger.error(e, { service: RewardsService.SERVICE_LOG_NAME });
        this.prometheusService.rewardsEventTriggered.labels({ result: 'error' });
      }
    });
    this.logger.log('Service initialized', { service: RewardsService.SERVICE_LOG_NAME });
  }

  protected async updateRewards(): Promise<void> {
    const rewardsPerFrame = await this.getMinLastTotalRewardsPerFrame();

    if (!rewardsPerFrame) {
      return;
    }

    this.rewardsStorage.setRewardsPerFrame(rewardsPerFrame.allRewards);
    this.rewardsStorage.setClRewardsPerFrame(rewardsPerFrame.clRewards);
    this.rewardsStorage.setElRewardsPerFrame(rewardsPerFrame.elRewards);
  }

  public async getMinLastTotalRewardsPerFrame() {
    const framesFromLastReports = await this.getFramesFromLastReports();
    if (framesFromLastReports === null) {
      this.logger.warn(
        'last reward reports were not found because last TokenRebase events were not found during last week.',
        { service: RewardsService.SERVICE_LOG_NAME },
      );
      return {
        clRewards: BigNumber.from(0),
        elRewards: BigNumber.from(0),
        allRewards: BigNumber.from(0),
      };
    }

    const rewards = await Promise.all(
      framesFromLastReports.map(async ({ blockNumber, frames }) => {
        const { clRewards, elRewards } = await this.getRewardsByBlockNumber(blockNumber, frames);

        return {
          clRewards,
          elRewards,
        };
      }),
    );

    let minCL = rewards[0].clRewards;
    let minEL = rewards[0].elRewards;

    // find minimum for last week
    rewards.forEach((r) => {
      if (minCL.lt(r.clRewards)) {
        minCL = r.clRewards;
      }

      if (minEL.lt(r.elRewards)) {
        minEL = r.elRewards;
      }
    });

    const allRewards = minEL.add(minCL);

    this.logger.log(`rewardsPerFrame are updated to ${allRewards.toString()}`, {
      service: RewardsService.SERVICE_LOG_NAME,
    });

    return {
      clRewards: minCL,
      elRewards: minEL,
      allRewards,
    };
  }

  protected async getRewardsByBlockNumber(blockNumber: number, framesPassed: BigNumber) {
    const { preCLBalance, postCLBalance } = await this.getEthDistributed(blockNumber);
    const elRewards = (await this.getElRewards(blockNumber)) ?? BigNumber.from(0);
    const withdrawalsReceived = (await this.getWithdrawalsReceived(blockNumber)) ?? BigNumber.from(0);

    const clValidatorsBalanceDiff = postCLBalance.sub(preCLBalance);
    const clRewards = clValidatorsBalanceDiff.add(withdrawalsReceived);

    return { clRewards: clRewards.div(framesPassed), elRewards: elRewards.div(framesPassed) };
  }

  protected async getHoursAgoBlock(hours: number) {
    const currentBlock = await this.provider.getBlockNumber();
    return currentBlock - Math.ceil((hours * 60 * 60) / SECONDS_PER_SLOT);
  }

  protected async getElRewards(fromBlock: number): Promise<BigNumber> {
    const res = this.contractLido.filters.ELRewardsReceived();
    const logs = await this.provider.getLogs({
      topics: res.topics,
      toBlock: 'latest',
      fromBlock,
      address: res.address,
    });
    const lastLog = logs[0];

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
    const logs = await getLogsByRetryCount(
      this.provider,
      {
        topics: res.topics,
        toBlock: 'latest',
        fromBlock,
        address: res.address,
      },
      this.logger,
      'ETHDistributed',
    );

    this.logger.log('ETHDistributed event logs', { service: RewardsService.SERVICE_LOG_NAME, logsCount: logs.length });

    const lastLog = logs[0];

    if (!lastLog) {
      this.logger.warn('ETHDistributed event is not found for CL balance.', {
        service: RewardsService.SERVICE_LOG_NAME,
        fromBlock,
      });

      // if balances is not found leave them empty and so diff CL (which is CL rewards) will be 0
      return {
        preCLBalance: BigNumber.from(0),
        postCLBalance: BigNumber.from(0),
      };
    }
    const parser = new Interface([LIDO_ETH_DESTRIBUTED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    this.logger.log('last ETHDistributed event', {
      service: RewardsService.SERVICE_LOG_NAME,
      args: parsedData.args,
      preCLBalance: parsedData.args.getValue('preCLBalance'),
      postCLBalance: parsedData.args.getValue('postCLBalance'),
      blockNumber: lastLog.blockNumber,
    });

    const preCLBalance = BigNumber.from(parsedData.args.getValue('preCLBalance'));
    const postCLBalance = BigNumber.from(parsedData.args.getValue('postCLBalance'));
    return { preCLBalance, postCLBalance };
  }

  protected async getWithdrawalsReceived(fromBlock: number): Promise<BigNumber> {
    const res = this.contractLido.filters.WithdrawalsReceived();
    const logs = await getLogsByRetryCount(
      this.provider,
      {
        topics: res.topics,
        toBlock: 'latest',
        fromBlock,
        address: res.address,
      },
      this.logger,
      'WithdrawalsReceived',
    );

    this.logger.log('WithdrawalsReceived event logs', {
      service: RewardsService.SERVICE_LOG_NAME,
      logsCount: logs.length,
    });

    const lastLog = logs[0];
    if (!lastLog) {
      return BigNumber.from(0);
    }
    const parser = new Interface([LIDO_WITHDRAWALS_RECEIVED_EVENT]);
    const parsedData = parser.parseLog(lastLog);

    this.logger.log('last WithdrawalsReceived event', {
      service: RewardsService.SERVICE_LOG_NAME,
      args: parsedData.args,
      amount: parsedData.args.getValue('amount'),
      blockNumber: lastLog.blockNumber,
    });

    return BigNumber.from(parsedData.args.getValue('amount'));
  }

  // reports can be skipped, so we need timeElapsed (time from last report)
  protected async getFramesFromLastReports() {
    const weekAgoBlock = await this.getHoursAgoBlock(ONE_WEEK_HOURS);

    const res = this.contractLido.filters.TokenRebased();

    const logs = await getLogsByRetryCount(
      this.provider,
      {
        topics: res.topics,
        toBlock: 'latest',
        fromBlock: weekAgoBlock,
        address: res.address,
      },
      this.logger,
      'TokenRebased',
    );

    this.logger.log('TokenRebase event logs for last week', {
      service: RewardsService.SERVICE_LOG_NAME,
      logsCount: logs.length,
    });

    if (logs.length === 0) {
      this.logger.warn('TokenRebase events are not found for last week.', {
        service: RewardsService.SERVICE_LOG_NAME,
      });

      return null;
    }

    const rewardsBlocks = logs.map((log) => {
      const parser = new Interface([LIDO_TOKEN_REBASED_EVENT]);
      const parsedData = parser.parseLog(log);

      return {
        blockNumber: log.blockNumber,
        frames: BigNumber.from(parsedData.args.getValue('timeElapsed')).div(
          SECONDS_PER_SLOT * SLOTS_PER_EPOCH * this.contractConfig.getEpochsPerFrame(),
        ),
      };
    });

    this.logger.log('last TokenRebase events for last week', {
      service: RewardsService.SERVICE_LOG_NAME,
      rewardsBlocks,
    });

    return rewardsBlocks;
  }

  // it includes WithdrawalVault balance and diff between rewards and cached rewards from previous report
  async getVaultsBalance(blockNumber: number) {
    const withdrawalVaultAddress = await this.lidoLocator.withdrawalVault({ blockTag: blockNumber });
    const withdrawalVaultBalance = await this.provider.getBalance(withdrawalVaultAddress, blockNumber);
    const rewardsVaultAddress = await this.lidoLocator.elRewardsVault({ blockTag: blockNumber });
    const rewardsVaultBalance = await this.provider.getBalance(rewardsVaultAddress, blockNumber);
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
