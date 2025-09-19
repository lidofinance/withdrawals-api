import { BigNumber } from '@ethersproject/bignumber';
import { WITHDRAWALS_VALIDATORS_PER_SLOT } from '../validators.constants';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';

/*
#### Algorithm of calculation withdrawal frame of validators:

1. Withdrawals sweep cursor goes from 0 to the last validator index in infinite loop.
2. When the cursor reaches a withdrawable validator, it withdraws ETH from that validator.
3. The cursor can withdraw from a maximum of 16 validators per slot.
4. We assume that all validators in network have to something to withdraw (partially or fully)
5. `percentOfActiveValidators` is used to exclude inactive validators from the queue, ensuring more accurate calculations.
6. Formula to get number of slots to wait is `(number of validators to withdraw before cursor get index of validator) / 16`
7. By knowing number slots we can calculate frame of withdrawal

Examples:

1. If the current cursor is 50 and the total number of validators is 100,
   then if we want to know when the validator with index 75 will be withdrawn:
   (75 - 50) / 16 = 2 slots.

2. If the current cursor is 50 and the total number of validators is 100,
   and we want to know when the validator with index 25 will be withdrawn
   (since the cursor will go to the end and start from 0):
   (100 - 50 + 25) / 16 = 5 slots.

*/
export function getValidatorWithdrawalTimestamp(
  validatorIndex: BigNumber,
  lastWithdrawalValidatorIndex: BigNumber,
  activeValidatorCount: number,
  totalValidatorsCount: number,
) {
  const diff = validatorIndex.sub(lastWithdrawalValidatorIndex);
  const percentOfActiveValidators = activeValidatorCount / totalValidatorsCount;
  const lengthQueueValidators = diff.lt(0)
    ? BigNumber.from(totalValidatorsCount).sub(lastWithdrawalValidatorIndex).add(validatorIndex)
    : diff;

  const slots = lengthQueueValidators.div(BigNumber.from(WITHDRAWALS_VALIDATORS_PER_SLOT));
  const seconds = slots.toNumber() * SECONDS_PER_SLOT * percentOfActiveValidators;

  return Date.now() + seconds * 1000;
}

export function getValidatorWithdrawalTimestampV2({
  validatorIndex,
  lastWithdrawalValidatorIndex,
  activeValidatorCount,
  totalValidatorsCount,
  currentEpoch,
  withdrawableEpoch,
  nowMs = Date.now(),
  validatorsPerSlot = WITHDRAWALS_VALIDATORS_PER_SLOT,
  slotsPerEpoch = SLOTS_PER_EPOCH,
  secondsPerSlot = SECONDS_PER_SLOT,
}: {
  validatorIndex: BigNumber;
  lastWithdrawalValidatorIndex: BigNumber;
  totalValidatorsCount: number;
  activeValidatorCount: number;
  currentEpoch: number;
  withdrawableEpoch: number;
  nowMs?: number;
  validatorsPerSlot?: number;
  slotsPerEpoch?: number;
  secondsPerSlot?: number;
}): number {
  const total = totalValidatorsCount;
  const vIdx = validatorIndex.toNumber();
  const lastIdx = lastWithdrawalValidatorIndex.toNumber();
  const percentOfActiveValidators = activeValidatorCount / totalValidatorsCount;

  const epochsUntilWE = Math.max(0, withdrawableEpoch - currentEpoch);
  const slotsUntilWE = epochsUntilWE * slotsPerEpoch;

  const expectedIndexAdvanceToWE = Math.floor((slotsUntilWE * validatorsPerSlot) / percentOfActiveValidators);
  const cursorAtWE = (lastIdx + (expectedIndexAdvanceToWE % total)) % total;

  const start = (cursorAtWE + 1) % total;

  const queuePosInclusive = ((vIdx - start + total) % total) + 1;
  const expectedActivesToProcess = Math.ceil((queuePosInclusive - 1) * percentOfActiveValidators) + 1;

  const slotsAfterWE = Math.ceil(expectedActivesToProcess / validatorsPerSlot);

  const totalSlots = slotsUntilWE + slotsAfterWE;

  const totalSeconds = totalSlots * secondsPerSlot;
  return nowMs + totalSeconds * 1000;
}
