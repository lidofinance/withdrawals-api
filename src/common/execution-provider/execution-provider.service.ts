import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { CHAINS } from '@lido-nestjs/constants';
import { Inject, Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../prometheus';
import { Filter, Log } from '@ethersproject/abstract-provider';
import { LoggerService } from '@lido-nestjs/logger';
import { LOGGER_PROVIDER } from '../logger';

@Injectable()
export class ExecutionProviderService {
  constructor(
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly prometheusService: PrometheusService,
    protected readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
  ) {}

  /**
   * Returns network name
   */
  public async getNetworkName(): Promise<string> {
    const network = await this.provider.getNetwork();
    const name = CHAINS[network.chainId]?.toLocaleLowerCase();
    return name || network.name;
  }

  /**
   * Returns current chain id
   */
  public async getChainId(): Promise<number> {
    const { chainId } = await this.provider.getNetwork();
    return chainId;
  }

  // using ethers.JsonRpcProvider direct request to "eth_getBlockByNumber"
  // default @ethersproject provider getBlock does not contain "withdrawals" property
  public async getLatestWithdrawals(): Promise<Array<{ validatorIndex: string }>> {
    const endTimer = this.prometheusService.elRpcRequestDuration.startTimer();
    try {
      const provider = new ethers.JsonRpcProvider(this.configService.get('EL_RPC_URLS')[0]);
      const block = await provider.send('eth_getBlockByNumber', ['latest', false]);
      endTimer({ result: 'success' });
      return block.withdrawals;
    } catch (error) {
      endTimer({ result: 'error' });
      throw error;
    }
  }

  public async getLogsByBlockStepsWithRetry(
    filter: Filter,
    eventName: string,
    serviceName: string,
    retryCount = this.configService.get('EL_RETRY_COUNT'),
    blockStep = this.configService.get('EL_BLOCK_STEP'),
  ): Promise<Log[]> {
    let logs: Log[] = [];
    const latestBlock = await this.provider.getBlockNumber();

    const fromBlock = Number(filter.fromBlock) ?? 0;
    const toBlock = typeof filter.toBlock === 'string' ? latestBlock : Number(filter.toBlock);

    for (let startBlock = fromBlock; startBlock <= toBlock; startBlock += blockStep) {
      const endBlock = Math.min(startBlock + blockStep - 1, toBlock);

      const blockFilter = { ...filter, fromBlock: startBlock, toBlock: endBlock };

      let attempt = 0;
      let blockLogs: Log[] = [];

      while (blockLogs.length === 0 && attempt < retryCount) {
        try {
          blockLogs = await this.provider.getLogs(blockFilter);
        } catch (error) {
          this.logger.error(`${eventName}: Error fetching logs for blocks ${startBlock} - ${endBlock}: ${error}`, {
            service: serviceName,
          });
        }

        if (blockLogs.length === 0) {
          this.logger.warn(
            `${eventName}: No logs found for blocks ${startBlock} - ${endBlock}. Retrying in 200 ms...`,
            {
              service: serviceName,
            },
          );
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        attempt += 1;
      }

      logs = logs.concat(blockLogs);
    }

    return logs;
  }
}
