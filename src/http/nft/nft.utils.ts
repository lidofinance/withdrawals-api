import { formatUnits } from 'ethers';

export const convertFromWei = (amountInWei: string, prefix?: string): string => {
  const amountInGwei = parseFloat(formatUnits(amountInWei.toString(), 'gwei'));
  const amountInEth = parseFloat(formatUnits(amountInWei.toString(), 'ether'));

  if (amountInEth >= 0.00009) {
    return `${parseFloat(amountInEth.toFixed(6))} ${prefix ? prefix : ''}ETH`;
  } else if (amountInGwei >= 1) {
    return `${parseFloat(amountInGwei.toFixed(2))} GWEI${prefix ? '(STETH)' : ''}`;
  } else {
    return `${amountInWei} WEI${prefix ? '(STETH)' : ''}`;
  }
};
