import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { CHAINS } from '@lido-nestjs/constants';
import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../prometheus';

@Injectable()
export class ExecutionProviderService {
  constructor(
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly prometheusService: PrometheusService,
    protected readonly configService: ConfigService,
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
}
