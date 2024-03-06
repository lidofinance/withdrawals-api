import { BigNumber } from '@ethersproject/bignumber';

export const parseGweiToWei = (gweiValue: string) => {
  const toWei = BigNumber.from('1000000000');
  return BigNumber.from(gweiValue).mul(toWei);
};
