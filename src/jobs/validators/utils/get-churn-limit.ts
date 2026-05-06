import { BigNumber } from '@ethersproject/bignumber';

const MIN_PER_EPOCH_CHURN_LIMIT = BigNumber.from(4); // 4 validators
const MIN_ACTIVATION_BALANCE = BigNumber.from('32000000000'); // 32 ETH in Gwei
const MAX_PER_EPOCH_CHURN_LIMIT = BigNumber.from('256000000000'); // 256 ETH in Gwei
const CHURN_LIMIT_QUOTIENT = BigNumber.from('65536');

// Total balance churn budget per epoch in Gwei: max(floor, totalActiveBalance / quotient).
// Same formula as the consensus spec `get_balance_churn_limit`. Returned uncapped so callers
// can derive both the exit-side and consolidation-side allocations from a single base.
function getBalanceChurnLimitGwei(totalActiveBalanceGwei: BigNumber): BigNumber {
  const minLimit = MIN_PER_EPOCH_CHURN_LIMIT.mul(MIN_ACTIVATION_BALANCE);
  const dynamicLimit = totalActiveBalanceGwei.div(CHURN_LIMIT_QUOTIENT);
  return dynamicLimit.gt(minLimit) ? dynamicLimit : minLimit;
}

/**
 * Calculates the churn limit (in Gwei) based on total active balance.
 * Pectra-style stake-based churn limit with min/max bounds.
 */
export function getChurnLimitGwei(totalActiveBalanceGwei: BigNumber): BigNumber {
  const balanceChurn = getBalanceChurnLimitGwei(totalActiveBalanceGwei);
  return balanceChurn.gt(MAX_PER_EPOCH_CHURN_LIMIT) ? MAX_PER_EPOCH_CHURN_LIMIT : balanceChurn;
}

/**
 * Returns average number of validators for churn limit.
 */
export function getChurnLimit(totalActiveBalanceGwei: BigNumber) {
  return getChurnLimitGwei(totalActiveBalanceGwei).div(MIN_ACTIVATION_BALANCE);
}

// Per Electra spec, consolidation churn = total balance churn − exit-side churn. When the
// exit-side cap is binding (large total active balance), consolidation gets the leftover;
// when balance churn is below the exit cap, consolidation gets zero. EIP-8080 routes idle
// consolidation churn back to exits, so this is the budget available for that uplift.
export function getConsolidationChurnLimitGwei(totalActiveBalanceGwei: BigNumber): BigNumber {
  const balanceChurn = getBalanceChurnLimitGwei(totalActiveBalanceGwei);
  const exitChurn = getChurnLimitGwei(totalActiveBalanceGwei);
  return balanceChurn.sub(exitChurn);
}
