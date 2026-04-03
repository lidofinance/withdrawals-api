import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { SLOTS_PER_EPOCH } from 'common/genesis-time/genesis-time.constants';
import { FAR_FUTURE_EPOCH } from './spec.constants';

@Injectable()
export class SpecService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly consensusProviderService: ConsensusProviderService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.refreshGlamsterdamForkEpoch();
  }

  public async refreshGlamsterdamForkEpoch(): Promise<void> {
    try {
      const spec = await this.consensusProviderService.getSpec();
      const glamsterdamForkEpoch = spec.data.GLOAS_FORK_EPOCH;

      if (glamsterdamForkEpoch !== FAR_FUTURE_EPOCH) {
        this.logger.warn('GLOAS_FORK_EPOCH is already known, cron job can be removed', {
          result: glamsterdamForkEpoch,
        });
      }

      if (!glamsterdamForkEpoch || glamsterdamForkEpoch === FAR_FUTURE_EPOCH) {
        return;
      }

      const nextForkEpoch = Number(glamsterdamForkEpoch);

      if (this.glamsterdamForkEpoch !== nextForkEpoch) {
        this.glamsterdamForkEpoch = nextForkEpoch;
        this.logger.log('Loaded GLOAS_FORK_EPOCH', { result: glamsterdamForkEpoch });
      }
    } catch (error) {
      this.logger.warn(`Failed to load Glamsterdam fork epoch from consensus spec: ${error.message}`);
    }
  }

  public hasKnownGlamsterdamForkEpoch(): boolean {
    return this.glamsterdamForkEpoch !== null;
  }

  public getGlamsterdamForkEpoch(): number | null {
    return this.glamsterdamForkEpoch;
  }

  public isGlamsterdamReleasedAtSlot(slot: number): boolean {
    if (this.glamsterdamForkEpoch === null) {
      return false;
    }

    return Math.floor(slot / SLOTS_PER_EPOCH) >= this.glamsterdamForkEpoch;
  }

  protected glamsterdamForkEpoch: number | null = null;
}
