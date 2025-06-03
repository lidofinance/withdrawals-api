import { BigNumber } from '@ethersproject/bignumber';

const MIN_PER_EPOCH_CHURN_LIMIT = BigNumber.from(4); // 4 validators
const MIN_ACTIVATION_BALANCE = BigNumber.from('32000000000'); // 32 ETH in Gwei
const MAX_PER_EPOCH_CHURN_LIMIT = BigNumber.from('256000000000'); // 256 ETH in Gwei
const CHURN_LIMIT_QUOTIENT = BigNumber.from('65536');

/**
 * Calculates the churn limit (in Gwei) based on total active balance.
 * Pectra-style stake-based churn limit with min/max bounds.
 */
export function getChurnLimitGwei(totalActiveBalanceGwei: BigNumber): BigNumber {
  const minLimit = MIN_PER_EPOCH_CHURN_LIMIT.mul(MIN_ACTIVATION_BALANCE);
  const dynamicLimit = totalActiveBalanceGwei.div(CHURN_LIMIT_QUOTIENT);
  const maxedLimit = dynamicLimit.gt(minLimit) ? dynamicLimit : minLimit;

  return maxedLimit.gt(MAX_PER_EPOCH_CHURN_LIMIT) ? MAX_PER_EPOCH_CHURN_LIMIT : maxedLimit;
}

/**
 * Returns average number of validators for churn limit.
 */
export function getChurnLimit(totalActiveBalanceGwei: BigNumber) {
  return getChurnLimitGwei(totalActiveBalanceGwei).div(MIN_ACTIVATION_BALANCE);
}
