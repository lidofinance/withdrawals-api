import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { LIDO_LOCATOR_CONTRACT_TOKEN, LidoLocator } from '@lido-nestjs/contracts';
import { ConfigService } from 'common/config';
import {
  isFullyWithdrawableValidator,
  isPartiallyWithdrawableValidator,
} from 'jobs/validators/utils/validator-state-utils';
import { ConsensusClientService } from 'common/consensus-provider/consensus-client.service';
import { BeaconState, IndexedValidator, Validator } from 'common/consensus-provider/consensus-provider.types';
import { parseGwei } from 'common/utils/parse-gwei';
import { bigNumberMin } from 'common/utils/big-number-min';
import { OracleV2__factory } from 'common/contracts/generated';
import { FAR_FUTURE_EPOCH } from 'jobs/validators';
import { SLOTS_PER_EPOCH } from 'common/genesis-time';
import {
  MAX_PENDING_PARTIALS_PER_WITHDRAWALS_SWEEP,
  MAX_WITHDRAWALS_PER_PAYLOAD,
  MIN_ACTIVATION_BALANCE,
} from 'waiting-time/waiting-time.constants';
import { Withdrawal } from './sweep.types';
import { ExecutionProvider } from '../execution-provider';

@Injectable()
export class SweepService {
  static SERVICE_LOG_NAME = 'sweep';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,
    protected readonly consensusClientService: ConsensusClientService,
    protected readonly configService: ConfigService,
    protected readonly provider: ExecutionProvider,
  ) {}

  async getConsensusVersion() {
    const address = await this.lidoLocator.validatorsExitBusOracle();
    const validatorExitBusOracle = OracleV2__factory.connect(address, {
      provider: this.provider as any,
    });

    return await validatorExitBusOracle.getConsensusVersion();
  }

  public async getSweepDelayInEpochs(indexedValidators: IndexedValidator[], currentEpoch: number) {
    const isElectraActivate = await this.consensusClientService.isElectraActivated(currentEpoch);
    const consensusVersion = await this.getConsensusVersion();

    this.logger.log('check electra info', {
      isElectraActivate,
      consensusVersion,
      service: SweepService.SERVICE_LOG_NAME,
    });

    if (consensusVersion < 3 || !isElectraActivate) {
      return this.getSweepDelayInEpochsPreElectra(indexedValidators, currentEpoch);
    }

    const state = await this.consensusClientService.getStateStream('head');
    return this.getSweepDelayInEpochsPostElectra(state, indexedValidators);
  }

  private getSweepDelayInEpochsPreElectra(indexedValidators: IndexedValidator[], epoch: number): number {
    const totalWithdrawableValidators = this.getWithdrawableValidatorsNumber(indexedValidators, epoch);

    const fullSweepInEpochs = totalWithdrawableValidators / MAX_WITHDRAWALS_PER_PAYLOAD / SLOTS_PER_EPOCH;
    const result = Math.floor(fullSweepInEpochs * 0.5);

    this.logger.log('calculated sweep delay in epochs pre electra', { result, service: SweepService.SERVICE_LOG_NAME });
    return result;
  }

  // pre pectra
  private getWithdrawableValidatorsNumber(indexedValidators: IndexedValidator[], epoch: number) {
    let count = 0;
    for (const v of indexedValidators) {
      if (
        isPartiallyWithdrawableValidator(v.validator, parseGwei(v.balance)) ||
        isFullyWithdrawableValidator(v.validator, parseGwei(v.balance), epoch)
      ) {
        count++;
      }
    }
    return count;
  }

  private getSweepDelayInEpochsPostElectra(state: BeaconState, indexedValidators: IndexedValidator[]): number {
    const withdrawalsNumberInSweepCycle = this.predictWithdrawalsNumberInSweepCycle(state, indexedValidators);
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

  private predictWithdrawalsNumberInSweepCycle(state: BeaconState, indexedValidators: IndexedValidator[]): number {
    const pendingPartialWithdrawals = this.getPendingPartialWithdrawals(state);
    const validatorsWithdrawalsNumber = this.getValidatorsWithdrawalsNumber(
      state,
      pendingPartialWithdrawals,
      indexedValidators,
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

  private getPendingPartialWithdrawals(state: BeaconState): Withdrawal[] {
    const withdrawals: Withdrawal[] = [];

    for (const pendingPartialWithdrawal of state.pending_partial_withdrawals) {
      const index = pendingPartialWithdrawal.validator_index;
      const validator: Validator = state.validators[index];
      const hasSufficientEffectiveBalance = parseGwei(validator.effective_balance).gte(MIN_ACTIVATION_BALANCE);
      const hasExcessBalance = parseGwei(state.balances[index]).gt(MIN_ACTIVATION_BALANCE);

      if (validator.exit_epoch === FAR_FUTURE_EPOCH.toString() && hasSufficientEffectiveBalance && hasExcessBalance) {
        const withdrawableBalance = bigNumberMin(
          parseGwei(state.balances[index]).sub(MIN_ACTIVATION_BALANCE),
          parseGwei(pendingPartialWithdrawal.amount),
        );
        withdrawals.push({ validatorIndex: index, amount: withdrawableBalance });
      }
    }
    return withdrawals;
  }

  // post pectra
  getValidatorsWithdrawalsNumber(
    state: BeaconState,
    partialWithdrawals: Withdrawal[],
    indexedValidators: IndexedValidator[],
  ): number {
    const epoch = Math.ceil(+state.slot / SLOTS_PER_EPOCH);
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
      const balance = parseGwei(state.balances[validatorIndex]).sub(partiallyWithdrawnBalance);

      if (isFullyWithdrawableValidator(validator, balance, epoch)) {
        withdrawalsNumber++;
      } else if (isPartiallyWithdrawableValidator(validator, balance)) {
        withdrawalsNumber++;
      }
    }

    return withdrawalsNumber;
  }
}
