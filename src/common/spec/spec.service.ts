import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { BigNumber } from '@ethersproject/bignumber';
import { SLOTS_PER_EPOCH } from 'common/genesis-time/genesis-time.constants';
import { FAR_FUTURE_EPOCH } from '../constants';
import { ChurnSpecParams, MAINNET_CHURN_SPEC_PARAMS } from './churn-spec-params';

@Injectable()
export class SpecService implements OnModuleInit {
  protected glamsterdamForkEpoch: number | null = null;
  protected slotsPerEpoch = SLOTS_PER_EPOCH;
  protected churnSpecParams: ChurnSpecParams = MAINNET_CHURN_SPEC_PARAMS;

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

      // devnets override churn params (e.g. glamsterdam devnet-8 sets CHURN_LIMIT_QUOTIENT=128),
      // so estimation prefers the live spec over the baked mainnet values
      this.churnSpecParams = {
        churnLimitQuotient: this.parseSpecBigNumber(
          spec.data.CHURN_LIMIT_QUOTIENT,
          MAINNET_CHURN_SPEC_PARAMS.churnLimitQuotient,
          'CHURN_LIMIT_QUOTIENT',
        ),
        churnLimitQuotientGloas: this.parseSpecBigNumber(
          spec.data.CHURN_LIMIT_QUOTIENT_GLOAS,
          MAINNET_CHURN_SPEC_PARAMS.churnLimitQuotientGloas,
          'CHURN_LIMIT_QUOTIENT_GLOAS',
        ),
        consolidationChurnLimitQuotient: this.parseSpecBigNumber(
          spec.data.CONSOLIDATION_CHURN_LIMIT_QUOTIENT,
          MAINNET_CHURN_SPEC_PARAMS.consolidationChurnLimitQuotient,
          'CONSOLIDATION_CHURN_LIMIT_QUOTIENT',
        ),
        minPerEpochChurnLimitGwei: this.parseSpecBigNumber(
          spec.data.MIN_PER_EPOCH_CHURN_LIMIT_ELECTRA,
          MAINNET_CHURN_SPEC_PARAMS.minPerEpochChurnLimitGwei,
          'MIN_PER_EPOCH_CHURN_LIMIT_ELECTRA',
        ),
        maxPerEpochActivationExitChurnLimitGwei: this.parseSpecBigNumber(
          spec.data.MAX_PER_EPOCH_ACTIVATION_EXIT_CHURN_LIMIT,
          MAINNET_CHURN_SPEC_PARAMS.maxPerEpochActivationExitChurnLimitGwei,
          'MAX_PER_EPOCH_ACTIVATION_EXIT_CHURN_LIMIT',
        ),
      };

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

  public getChurnSpecParams(): ChurnSpecParams {
    return this.churnSpecParams;
  }

  protected parseSpecBigNumber(value: unknown, fallback: BigNumber, fieldName: string): BigNumber {
    if (typeof value === 'string' && /^[0-9]+$/.test(value) && BigNumber.from(value).gt(0)) {
      return BigNumber.from(value);
    }

    if (value !== undefined) {
      this.logger.warn(`Failed to parse ${fieldName} from consensus spec, fallback to ${fallback.toString()}`);
    }

    return fallback;
  }
}
