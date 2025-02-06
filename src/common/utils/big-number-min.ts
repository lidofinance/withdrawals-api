import { BigNumber } from '@ethersproject/bignumber';

export const bigNumberMin = (a: BigNumber, b: BigNumber) => {
  return a.lt(b) ? a : b;
};
