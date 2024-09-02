import { BigNumber } from '@ethersproject/bignumber';

export function stringifyFrameBalances(frameBalances: Record<string, BigNumber>) {
  return JSON.stringify(
    Object.keys(frameBalances).reduce((acc, key) => {
      return { ...acc, [key]: frameBalances[key].toString() };
    }, {}),
  );
}
