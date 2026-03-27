import { BigNumber } from '@ethersproject/bignumber';

export interface Withdrawal {
  validatorIndex: string;
  amount: BigNumber;
}

export interface WithdrawalSweepState {
  sweepCursorValidatorIndex: BigNumber;
  hasDeferredWithdrawals: boolean;
  stateSlot?: string;
  latestFullSlot?: string;
  source: 'consensus' | 'execution';
}
