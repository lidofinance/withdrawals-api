import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ExecutionProvider } from 'common/execution-provider';
import { MAX_BLOCK_DELAY_CONSENSUS_SECONDS, MAX_BLOCK_DELAY_SECONDS } from './health.constants';

@Injectable()
export class ExecutionProviderHealthIndicator extends HealthIndicator {
  constructor(private provider: ExecutionProvider) {
    super();
  }

  public async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const blockTimestamp = await this.getBlockTimestamp();
    const nowTimestamp = this.getNowTimestamp();
    const deltaTimestamp = Math.abs(nowTimestamp - blockTimestamp);

    const isHealthy = deltaTimestamp < MAX_BLOCK_DELAY_CONSENSUS_SECONDS;
    const result = this.getStatus(key, isHealthy, {
      blockTimestamp,
      nowTimestamp,
    });

    if (isHealthy) return result;
    throw new HealthCheckError('Provider check failed', result);
  }

  protected async getBlockTimestamp() {
    try {
      const block = await this.provider.getBlock('latest');
      return block.timestamp;
    } catch (error) {
      return -1;
    }
  }

  protected getNowTimestamp() {
    return Math.floor(Date.now() / 1000);
  }
}
