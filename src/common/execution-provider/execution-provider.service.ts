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
      const block = await this.sendWithFallback('eth_getBlockByNumber', ['latest', false]);
      endTimer({ result: 'success' });
      return block.withdrawals;
    } catch (error) {
      endTimer({ result: 'error' });
      throw error;
    }
  }

  public async sendWithFallback(method: string, params: Array<any>) {
    const elRpcUrls: string[] = this.configService.get('EL_RPC_URLS');

    for (let i = 0; i < elRpcUrls.length; i++) {
      const url = elRpcUrls[i];
      try {
        const provider = new ethers.JsonRpcProvider(url);
        return await provider.send(method, params);
      } catch (error) {
        if (i === elRpcUrls.length - 1) {
          throw error;
        } else {
          this.logger.warn(`RPC provider [${i}] failed. Switching to the next provider.`);
        }
      }
    }
  }

  public async getLogsByBlockStepsWithRetry(
    filter: Filter,
    eventName: string,
    serviceName: string,
    retryCount: number = this.configService.get('EL_RETRY_COUNT'),
    blockStep: number = this.configService.get('EL_BLOCK_STEP'),
  ): Promise<Log[]> {
    let logs: Log[] = [];
    const toBlock =
      typeof filter.toBlock === 'number' ? filter.toBlock : (await this.provider.getBlock(filter.toBlock)).number;
    const fromBlock =
      typeof filter.fromBlock === 'number' ? filter.fromBlock : (await this.provider.getBlock(filter.fromBlock)).number;

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
          this.logger.debug(
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
