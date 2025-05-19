import { BigNumber } from '@ethersproject/bignumber';

export const toEth = (bigNumberWei: BigNumber) => {
  return bigNumberWei.div(BigNumber.from('1000000000000000000'));
};
