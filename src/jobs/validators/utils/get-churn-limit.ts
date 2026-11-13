import { BigNumber } from '@ethersproject/bignumber';
import { ChurnSpecParams, MAINNET_CHURN_SPEC_PARAMS } from '../../../common/spec/churn-spec-params';

const MIN_ACTIVATION_BALANCE = BigNumber.from('32000000000'); // 32 ETH in Gwei

/**
 * Calculates the estimated exit churn limit (in Gwei) based on total active balance.
 * EIP-8061 removes the exit cap and halves the quotient from 2**16 to 2**15.
 * Quotients and bounds come from the live consensus spec (devnets override them);
 * mainnet values are the fallback.
 */
export function getExitChurnLimitGwei(
  totalActiveBalanceGwei: BigNumber,
  isGlamsterdam: boolean,
  params: ChurnSpecParams = MAINNET_CHURN_SPEC_PARAMS,
): BigNumber {
  const minLimit = params.minPerEpochChurnLimitGwei;
  const dynamicLimit = totalActiveBalanceGwei.div(
    isGlamsterdam ? params.churnLimitQuotientGloas : params.churnLimitQuotient,
  );
  const boundedLimit = dynamicLimit.gt(minLimit) ? dynamicLimit : minLimit;

  if (isGlamsterdam) {
    return boundedLimit;
  }

  return boundedLimit.gt(params.maxPerEpochActivationExitChurnLimitGwei)
    ? params.maxPerEpochActivationExitChurnLimitGwei
    : boundedLimit;
}

/**
 * Returns the estimated number of 32 ETH validators that can exit per epoch.
 */
export function getExitChurnLimit(
  totalActiveBalanceGwei: BigNumber,
  isGlamsterdam: boolean,
  params: ChurnSpecParams = MAINNET_CHURN_SPEC_PARAMS,
) {
  return getExitChurnLimitGwei(totalActiveBalanceGwei, isGlamsterdam, params).div(MIN_ACTIVATION_BALANCE);
}

/**
 * Returns the estimated consolidation churn limit in 32 ETH validator-equivalents.
 * EIP-8061 splits the churn budget: consolidations keep the 2**16 quotient.
 */
export function getConsolidationChurnLimit(
  totalActiveBalanceGwei: BigNumber,
  params: ChurnSpecParams = MAINNET_CHURN_SPEC_PARAMS,
) {
  return totalActiveBalanceGwei.div(params.consolidationChurnLimitQuotient).div(MIN_ACTIVATION_BALANCE);
}
