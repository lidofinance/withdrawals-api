import { BigNumber } from '@ethersproject/bignumber';

export interface Withdrawal {
  validatorIndex: string;
  amount: BigNumber;
}

export interface BuilderWithdrawalsStats {
  pending: number;
  exited: number;
}

export interface WithdrawalSweepState {
  sweepCursorValidatorIndex: BigNumber;
  hasDeferredWithdrawals: boolean;
  blockedByDeferredSlots: number;
  stateSlot?: string;
  source: 'consensus' | 'execution';
}
