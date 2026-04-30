import { BigNumber } from '@ethersproject/bignumber';

const MIN_PER_EPOCH_CHURN_LIMIT = BigNumber.from(4); // 4 validators
const MIN_ACTIVATION_BALANCE = BigNumber.from('32000000000'); // 32 ETH in Gwei
const CHURN_LIMIT_QUOTIENT_GLOAS = BigNumber.from('32768');
const CONSOLIDATION_CHURN_LIMIT_QUOTIENT = BigNumber.from('65536');

/**
 * Calculates the estimated exit churn limit (in Gwei) based on total active balance.
 * EIP-8061 removes the exit cap and halves the quotient from 2**16 to 2**15.
 */
export function getChurnLimitGwei(totalActiveBalanceGwei: BigNumber): BigNumber {
  const minLimit = MIN_PER_EPOCH_CHURN_LIMIT.mul(MIN_ACTIVATION_BALANCE);
  const dynamicLimit = totalActiveBalanceGwei.div(CHURN_LIMIT_QUOTIENT_GLOAS);
  return dynamicLimit.gt(minLimit) ? dynamicLimit : minLimit;
}

/**
 * Returns the estimated number of 32 ETH validators that can exit per epoch.
 */
export function getChurnLimit(totalActiveBalanceGwei: BigNumber) {
  return getChurnLimitGwei(totalActiveBalanceGwei).div(MIN_ACTIVATION_BALANCE);
}

/**
 * Returns the estimated consolidation churn limit in 32 ETH validator-equivalents.
 * Saved for future EIP-8080 heuristics.
 */
export function getConsolidationChurnLimit(totalActiveBalanceGwei: BigNumber) {
  return totalActiveBalanceGwei.div(CONSOLIDATION_CHURN_LIMIT_QUOTIENT).div(MIN_ACTIVATION_BALANCE);
}
