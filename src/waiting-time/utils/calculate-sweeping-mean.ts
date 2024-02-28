import { BigNumber } from '@ethersproject/bignumber';

import { SLOTS_PER_EPOCH } from 'common/genesis-time';
import { MAX_WITHDRAWALS_PER_PAYLOAD } from 'waiting-time/waiting-time.constants';

// time to scan all validators and try to withdraw it
export const calculateSweepingMean = (totalValidators: number) => {
  return BigNumber.from(totalValidators).div(BigNumber.from(MAX_WITHDRAWALS_PER_PAYLOAD).mul(SLOTS_PER_EPOCH)).div(2);
};
