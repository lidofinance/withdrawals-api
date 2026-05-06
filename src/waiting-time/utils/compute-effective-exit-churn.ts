import { BigNumber } from '@ethersproject/bignumber';

export type ComputeEffectiveExitChurnArgs = {
  // Whether the chain is past the EIP-8080 fork epoch. Pre-fork callers must pass `false`
  // to preserve the legacy single-queue formula; otherwise the model over-promises and
  // user-facing finalisation estimates land sooner than the chain can actually deliver.
  isExitViaConsolidationActive: boolean;

  // Beacon-state fields read by the validators job. Absolute epoch numbers (BigNumber to
  // tolerate the post-Electra range without precision loss).
  earliestExitEpoch: BigNumber;
  earliestConsolidationEpoch: BigNumber;

  // Per-epoch churn budgets in Gwei, as exposed by the beacon chain spec. Caller is
  // responsible for sourcing these consistently with the same beacon-state read used for
  // earliestExitEpoch / earliestConsolidationEpoch — otherwise the EIP-8080 branch
  // operates on an inconsistent snapshot.
  exitChurnPerEpochGwei: BigNumber;
  consolidationChurnPerEpochGwei: BigNumber;
};

// Per EIP-8080 spec rationale, exit balance routed through the consolidation queue is
// scaled by 2/3 to preserve weak-subjectivity equivalence between the two churn types.
const WEAK_SUBJECTIVITY_NUM = BigNumber.from(2);
const WEAK_SUBJECTIVITY_DEN = BigNumber.from(3);

// Returns the effective per-epoch exit-side churn budget in Gwei, modelling EIP-8080.
//
// Pre-fork (or flag off): returns exitChurnPerEpochGwei verbatim — legacy behaviour.
// Post-fork, when the exit queue is ahead of the consolidation queue: exits also draw
// from consolidation churn, so the total effective budget is exit-churn plus the
// 2/3-scaled consolidation-churn allocation. This is the same direction (× 3/2) implied
// by the EIP's `2 * exit_balance // 3` scaling: each unit of consolidation churn
// processes 1.5 units of equivalent exit-side balance.
//
// Post-fork, when the consolidation queue is ahead of (or equal to) the exit queue:
// EIP-8080's branch does not fire — exits stay on the exit queue. Returns
// exitChurnPerEpochGwei.
export const computeEffectiveExitChurnPerEpochGwei = (args: ComputeEffectiveExitChurnArgs): BigNumber => {
  const {
    isExitViaConsolidationActive,
    earliestExitEpoch,
    earliestConsolidationEpoch,
    exitChurnPerEpochGwei,
    consolidationChurnPerEpochGwei,
  } = args;

  if (!isExitViaConsolidationActive) {
    return exitChurnPerEpochGwei;
  }

  if (earliestExitEpoch.lte(earliestConsolidationEpoch)) {
    return exitChurnPerEpochGwei;
  }

  // Convert consolidation-side budget into its exit-side equivalent. EIP-8080 scales
  // routed exits by 2/3 of their balance, so for a fixed consolidation churn budget B,
  // the equivalent exit-side throughput is B × (3/2). BigNumber integer arithmetic:
  // multiply first, divide second to preserve precision.
  const consolidationAsExitEquivalent = consolidationChurnPerEpochGwei
    .mul(WEAK_SUBJECTIVITY_DEN)
    .div(WEAK_SUBJECTIVITY_NUM);

  return exitChurnPerEpochGwei.add(consolidationAsExitEquivalent);
};
