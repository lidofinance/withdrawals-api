import { BigNumber } from '@ethersproject/bignumber';

export interface Withdrawal {
  validatorIndex: string;
  amount: BigNumber;
}
