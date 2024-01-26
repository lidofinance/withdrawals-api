import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { MAX_BLOCK_DELAY_SECONDS } from './health.constants';
import { ConsensusProviderService } from '../consensus-provider';
import { GenesisTimeService } from '../genesis-time';

@Injectable()
export class ConsensusProviderIndicator extends HealthIndicator {
  constructor(
    private readonly consensusProviderService: ConsensusProviderService,
    private readonly genesisTimeService: GenesisTimeService,
  ) {
    super();
  }

  public async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const blockTimestamp = await this.getBlockTimestamp();
    const nowTimestamp = this.getNowTimestamp();
    const deltaTimestamp = Math.abs(nowTimestamp - blockTimestamp);

    const isHealthy = deltaTimestamp < MAX_BLOCK_DELAY_SECONDS;
    const result = this.getStatus(key, isHealthy, {
      blockTimestamp,
      nowTimestamp,
    });

    if (isHealthy) return result;
    throw new HealthCheckError('Provider check failed', result);
  }

  protected async getBlockTimestamp() {
    try {
      const head = await this.consensusProviderService.getBlockHeader({ blockId: 'head' });
      return this.genesisTimeService.getSlotTime(Number(head.data.header.message.slot));
    } catch (error) {
      return -1;
    }
  }

  protected getNowTimestamp() {
    return Math.floor(Date.now() / 1000);
  }
}
