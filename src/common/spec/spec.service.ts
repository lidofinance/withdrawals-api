import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { SLOTS_PER_EPOCH } from 'common/genesis-time/genesis-time.constants';
import { FAR_FUTURE_EPOCH } from '../constants';

@Injectable()
export class SpecService implements OnModuleInit {
  protected glamsterdamForkEpoch: number | null = null;
  protected slotsPerEpoch = SLOTS_PER_EPOCH;

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
      const glamsterdamForkEpoch = spec.data.GLOAS_FORK_EPOCH as string;
      const slotsPerEpoch = Number(spec.data.SLOTS_PER_EPOCH);

      if (Number.isFinite(slotsPerEpoch) && slotsPerEpoch > 0) {
        this.slotsPerEpoch = slotsPerEpoch;
      } else {
        this.logger.warn(`Failed to parse SLOTS_PER_EPOCH from consensus spec, fallback to ${SLOTS_PER_EPOCH}`);
      }

      if (glamsterdamForkEpoch !== FAR_FUTURE_EPOCH.toString()) {
        this.logger.warn('GLOAS_FORK_EPOCH is already known, cron job can be removed', {
          result: glamsterdamForkEpoch,
        });
      }

      if (!glamsterdamForkEpoch || glamsterdamForkEpoch === FAR_FUTURE_EPOCH.toString()) {
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

  public isGlamsterdamReleasedAtEpoch(epoch: number): boolean {
    if (this.glamsterdamForkEpoch === null) {
      return false;
    }

    return epoch >= this.glamsterdamForkEpoch;
  }

  public isGlamsterdamReleasedAtSlot(slot: number): boolean {
    return this.isGlamsterdamReleasedAtEpoch(Math.floor(slot / this.slotsPerEpoch));
  }
}
