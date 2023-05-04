import { formatUnits } from 'ethers';

import { MAX_AMOUNT_IN_ETH } from './nft.constants';

export const convertFromWei = (amountInWei: string, prefix?: string): string => {
  const convertedInWei = parseFloat(formatUnits(amountInWei.toString(), 'wei'));
  const amountInGwei = parseFloat(formatUnits(amountInWei.toString(), 'gwei'));
  const amountInEth = parseFloat(formatUnits(amountInWei.toString(), 'ether'));

  if (amountInEth > 0.00009) {
    return `${parseFloat(String(Math.floor(amountInEth * 10000) / 10000))} ${prefix ? prefix : ''}ETH`;
  } else if (amountInGwei >= 1) {
    return `${parseFloat(amountInGwei.toFixed(2))} GWEI${prefix ? '(STETH)' : ''}`;
  } else {
    return `${convertedInWei} WEI${prefix ? '(STETH)' : ''}`;
  }
};

export const validateWeiAmount = (amount: string, key: string): { isValid: boolean; message?: string } => {
  try {
    const amountInEth = parseFloat(formatUnits(amount.toString(), 'ether'));

    if (amountInEth >= MAX_AMOUNT_IN_ETH) return { isValid: false, message: `${key} is too big` };
    else return { isValid: true };
  } catch (error) {
    return { isValid: false, message: `${key} is not valid` };
  }
};
