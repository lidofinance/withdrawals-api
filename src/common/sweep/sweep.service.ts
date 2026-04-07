import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import {
  isFullyWithdrawableValidator,
  isPartiallyWithdrawableValidator,
} from 'jobs/validators/utils/validator-state-utils';
import { ConsensusClientService } from 'common/consensus-provider/consensus-client.service';
import {
  IndexedValidator,
  PendingPartialWithdrawal,
  Validator,
} from 'common/consensus-provider/consensus-provider.types';
import { FAR_FUTURE_EPOCH } from 'common/constants';
import { parseGwei } from 'common/utils/parse-gwei';
import { bigNumberMin } from 'common/utils/big-number-min';
import { SLOTS_PER_EPOCH } from 'common/genesis-time';
import {
  MAX_PENDING_PARTIALS_PER_WITHDRAWALS_SWEEP,
  MAX_WITHDRAWALS_PER_PAYLOAD,
  MIN_ACTIVATION_BALANCE,
} from 'waiting-time/waiting-time.constants';
import { Withdrawal } from './sweep.types';

@Injectable()
export class SweepService {
  static SERVICE_LOG_NAME = 'sweep';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly consensusClientService: ConsensusClientService,
  ) {}

  public async getSweepDelayInEpochs(indexedValidators: IndexedValidator[], currentEpoch: number) {
    const pendingPartialWithdrawals = await this.consensusClientService.getPendingPartialWithdrawals('head');
    return this.getSweepDelayInEpochsPostElectra(pendingPartialWithdrawals, indexedValidators, currentEpoch);
  }

  private getSweepDelayInEpochsPostElectra(
    pendingPartialWithdrawals: PendingPartialWithdrawal[],
    indexedValidators: IndexedValidator[],
    epoch: number,
  ): number {
    const withdrawalsNumberInSweepCycle = this.predictWithdrawalsNumberInSweepCycle(
      pendingPartialWithdrawals,
      indexedValidators,
      epoch,
    );
    const fullSweepCycleInEpochs = Math.ceil(
      withdrawalsNumberInSweepCycle / MAX_WITHDRAWALS_PER_PAYLOAD / SLOTS_PER_EPOCH,
    );

    const result = Math.floor(fullSweepCycleInEpochs * 0.5);
    this.logger.log('calculated sweep delay in epochs post electra', {
      result,
      service: SweepService.SERVICE_LOG_NAME,
    });
    return result;
  }

  private predictWithdrawalsNumberInSweepCycle(
    pendingPartialWithdrawalsData: PendingPartialWithdrawal[],
    indexedValidators: IndexedValidator[],
    epoch: number,
  ): number {
    const pendingPartialWithdrawals = this.getPendingPartialWithdrawals(
      pendingPartialWithdrawalsData,
      indexedValidators,
    );
    const validatorsWithdrawalsNumber = this.getValidatorsWithdrawalsNumber(
      pendingPartialWithdrawals,
      indexedValidators,
      epoch,
    );

    const pendingPartialWithdrawalsNumber = pendingPartialWithdrawals.length;

    const partialWithdrawalsMaxRatio =
      MAX_PENDING_PARTIALS_PER_WITHDRAWALS_SWEEP /
      (MAX_WITHDRAWALS_PER_PAYLOAD - MAX_PENDING_PARTIALS_PER_WITHDRAWALS_SWEEP);

    const pendingPartialWithdrawalsMaxNumberInCycle = Math.ceil(
      validatorsWithdrawalsNumber * partialWithdrawalsMaxRatio,
    );

    const pendingPartialWithdrawalsNumberInCycle = Math.min(
      pendingPartialWithdrawalsNumber,
      pendingPartialWithdrawalsMaxNumberInCycle,
    );
    return validatorsWithdrawalsNumber + pendingPartialWithdrawalsNumberInCycle;
  }

  private getPendingPartialWithdrawals(
    pendingPartialWithdrawalsData: PendingPartialWithdrawal[],
    indexedValidators: IndexedValidator[],
  ): Withdrawal[] {
    const withdrawals: Withdrawal[] = [];
    const indexedValidatorsMap = indexedValidators.reduce((acc, indexedValidator) => {
      acc[indexedValidator.index] = indexedValidator;
      return acc;
    }, {} as Record<string, IndexedValidator>);

    for (const pendingPartialWithdrawal of pendingPartialWithdrawalsData) {
      const index = pendingPartialWithdrawal.validator_index;
      const indexedValidator = indexedValidatorsMap[index];

      if (!indexedValidator) {
        continue;
      }

      const validator: Validator = indexedValidator.validator;
      const balance = parseGwei(indexedValidator.balance);
      const hasSufficientEffectiveBalance = parseGwei(validator.effective_balance).gte(MIN_ACTIVATION_BALANCE);
      const hasExcessBalance = balance.gt(MIN_ACTIVATION_BALANCE);

      if (validator.exit_epoch === FAR_FUTURE_EPOCH.toString() && hasSufficientEffectiveBalance && hasExcessBalance) {
        const withdrawableBalance = bigNumberMin(
          balance.sub(MIN_ACTIVATION_BALANCE),
          parseGwei(pendingPartialWithdrawal.amount),
        );
        withdrawals.push({ validatorIndex: index, amount: withdrawableBalance });
      }
    }
    return withdrawals;
  }

  getValidatorsWithdrawalsNumber(
    partialWithdrawals: Withdrawal[],
    indexedValidators: IndexedValidator[],
    epoch: number,
  ): number {
    const partiallyWithdrawnMap: Record<number, number> = {};
    let withdrawalsNumber = 0;

    for (const withdrawal of partialWithdrawals) {
      partiallyWithdrawnMap[withdrawal.validatorIndex] =
        (partiallyWithdrawnMap[withdrawal.validatorIndex] || 0) + withdrawal.amount;
    }

    for (const indexedValidator of indexedValidators) {
      const validatorIndex = indexedValidator.index;
      const validator = indexedValidator.validator;
      const partiallyWithdrawnBalance = partiallyWithdrawnMap[validatorIndex] || 0;
      const balance = parseGwei(indexedValidator.balance).sub(partiallyWithdrawnBalance);

      if (isFullyWithdrawableValidator(validator, balance, epoch)) {
        withdrawalsNumber++;
      } else if (isPartiallyWithdrawableValidator(validator, balance)) {
        withdrawalsNumber++;
      }
    }

    return withdrawalsNumber;
  }
}
