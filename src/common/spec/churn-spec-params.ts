import { BigNumber } from '@ethersproject/bignumber';

export interface ChurnSpecParams {
  // pre-Gloas exit/activation quotient (2**16)
  churnLimitQuotient: BigNumber;
  // EIP-8061 exit quotient after Gloas (2**15)
  churnLimitQuotientGloas: BigNumber;
  // EIP-8061 consolidation quotient (2**16)
  consolidationChurnLimitQuotient: BigNumber;
  // MIN_PER_EPOCH_CHURN_LIMIT_ELECTRA, Gwei (128 ETH)
  minPerEpochChurnLimitGwei: BigNumber;
  // MAX_PER_EPOCH_ACTIVATION_EXIT_CHURN_LIMIT, Gwei (256 ETH) — caps exits only before Gloas
  maxPerEpochActivationExitChurnLimitGwei: BigNumber;
}

// mainnet values; devnets override them via /eth/v1/config/spec (e.g. glamsterdam
// devnet-8 runs CHURN_LIMIT_QUOTIENT=128), so estimation must prefer the live spec
export const MAINNET_CHURN_SPEC_PARAMS: ChurnSpecParams = {
  churnLimitQuotient: BigNumber.from(65536),
  churnLimitQuotientGloas: BigNumber.from(32768),
  consolidationChurnLimitQuotient: BigNumber.from(65536),
  minPerEpochChurnLimitGwei: BigNumber.from('128000000000'),
  maxPerEpochActivationExitChurnLimitGwei: BigNumber.from('256000000000'),
};
