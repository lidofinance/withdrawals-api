import { formatUnits } from 'ethers';

import { MAX_AMOUNT_IN_ETH, MIN_AMOUNT_IN_WEI } from './nft.constants';

export const convertFromWei = (amountInWei: string, prefix?: string): string => {
  const convertedInWei = parseFloat(formatUnits(amountInWei.toString(), 'wei'));
  const amountInGwei = Math.floor(Number(formatUnits(amountInWei.toString(), 'gwei')) * 10000) / 10000;
  const amountInEth = Math.floor(Number(formatUnits(amountInWei.toString(), 'ether')) * 10000) / 10000;

  if (amountInEth > 0.00009) {
    return `${parseFloat(String(amountInEth))} ${prefix ? prefix : ''}ETH`;
  } else if (amountInGwei > 0.00009) {
    return `${parseFloat(String(amountInGwei))} GWEI${prefix ? '(STETH)' : ''}`;
  } else {
    return `${convertedInWei} WEI${prefix ? '(STETH)' : ''}`;
  }
};

export const validateWeiAmount = (amount: string, key: string): { isValid: boolean; message?: string } => {
  try {
    const amountInEth = parseFloat(formatUnits(amount.toString(), 'ether'));
    const amountInWei = parseFloat(formatUnits(amount.toString(), 'wei'));

    if (amountInEth > MAX_AMOUNT_IN_ETH) return { isValid: false, message: `${key} is too big` };
    if (amountInWei < MIN_AMOUNT_IN_WEI) return { isValid: false, message: `${key} is too small` };
    else return { isValid: true };
  } catch (error) {
    return { isValid: false, message: `${key} is not valid` };
  }
};
