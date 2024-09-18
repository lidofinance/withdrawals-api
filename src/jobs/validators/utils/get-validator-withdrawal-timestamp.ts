import { BigNumber } from '@ethersproject/bignumber';
import { WITHDRAWALS_VALIDATORS_PER_SLOT } from '../validators.constants';
import { SECONDS_PER_SLOT } from '../../../common/genesis-time';

/*
algorithm:
1. cursor goes from 0 to last validator index in queue
2. when cursor comes to withdrawable validator, it withdraws eth from it
3. cursor can withdraw only 16 validators per slot
4. percentOfActiveValidators is used to get rid of inactive validators in queue
   and make more accurate calculation


examples:
1. if current cursor is 50 and total validators 100,
   then if we want to know when will be withdrawn validator with index 75
   (75 - 50) / 16 = 2 slots

2. if current cursor is 50 and total validators 100,
   then if we want to know when will be withdrawn validator with index 25
   (cursor will go to the end and start from 0)
   (100 - 50 + 25) / 16 = 5 slots
*/
export function getValidatorWithdrawalTimestamp(
  index: BigNumber,
  lastWithdrawalValidatorIndex: BigNumber,
  activeValidatorCount: number,
  totalValidatorsCount: number,
) {
  const diff = index.sub(lastWithdrawalValidatorIndex);
  const percentOfActiveValidators = activeValidatorCount / totalValidatorsCount;
  const lengthQueueValidators = diff.lt(0)
    ? BigNumber.from(activeValidatorCount).sub(lastWithdrawalValidatorIndex.add(index))
    : diff;

  const slots = lengthQueueValidators.div(BigNumber.from(WITHDRAWALS_VALIDATORS_PER_SLOT));
  const seconds = slots.toNumber() * SECONDS_PER_SLOT * percentOfActiveValidators;
  console.log(`${index.toNumber()} | ${seconds / (60 * 60)} hours`);
  return Date.now() + seconds * 1000;
}
