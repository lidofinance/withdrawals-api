import { BigNumber } from '@ethersproject/bignumber';
import { computeEffectiveExitChurnPerEpochGwei } from './compute-effective-exit-churn';

describe('computeEffectiveExitChurnPerEpochGwei', () => {
  // 256 ETH in Gwei — current legacy hard cap on exit churn (see get-churn-limit.ts).
  const exitChurn256 = BigNumber.from('256000000000');
  // 432 ETH in Gwei — typical post-Electra consolidation churn cap on mainnet.
  const consolidationChurn432 = BigNumber.from('432000000000');

  it('returns legacy exit churn unchanged when feature flag is off, regardless of queue state', () => {
    const result = computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: false,
      earliestExitEpoch: BigNumber.from(1_000_000),
      earliestConsolidationEpoch: BigNumber.from(500_000),
      exitChurnPerEpochGwei: exitChurn256,
      consolidationChurnPerEpochGwei: consolidationChurn432,
    });

    expect(result.eq(exitChurn256)).toBe(true);
  });

  it('returns legacy exit churn when queues are equal — EIP-8080 branch is strictly greater-than', () => {
    const result = computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: true,
      earliestExitEpoch: BigNumber.from(500_000),
      earliestConsolidationEpoch: BigNumber.from(500_000),
      exitChurnPerEpochGwei: exitChurn256,
      consolidationChurnPerEpochGwei: consolidationChurn432,
    });

    expect(result.eq(exitChurn256)).toBe(true);
  });

  it('returns legacy exit churn when consolidation queue is longer than exit queue', () => {
    const result = computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: true,
      earliestExitEpoch: BigNumber.from(500_000),
      earliestConsolidationEpoch: BigNumber.from(600_000),
      exitChurnPerEpochGwei: exitChurn256,
      consolidationChurnPerEpochGwei: consolidationChurn432,
    });

    expect(result.eq(exitChurn256)).toBe(true);
  });

  it('adds consolidation churn scaled by 3/2 when exit queue is longer than consolidation queue', () => {
    // 256 + 432 × 3/2 = 256 + 648 = 904 ETH/epoch
    const expected = BigNumber.from('904000000000');

    const result = computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: true,
      earliestExitEpoch: BigNumber.from(600_000),
      earliestConsolidationEpoch: BigNumber.from(500_000),
      exitChurnPerEpochGwei: exitChurn256,
      consolidationChurnPerEpochGwei: consolidationChurn432,
    });

    expect(result.eq(expected)).toBe(true);
  });

  it('handles zero consolidation churn (queue at floor) — effective equals legacy exit churn', () => {
    const result = computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: true,
      earliestExitEpoch: BigNumber.from(600_000),
      earliestConsolidationEpoch: BigNumber.from(500_000),
      exitChurnPerEpochGwei: exitChurn256,
      consolidationChurnPerEpochGwei: BigNumber.from(0),
    });

    expect(result.eq(exitChurn256)).toBe(true);
  });

  it('uses BigNumber integer division — multiply-before-divide preserves precision on odd inputs', () => {
    // consolidation = 5 Gwei; 5 × 3 = 15; 15 / 2 = 7 (integer division). Multiply-first
    // would give 7; divide-first (5 / 2 = 2; 2 × 3 = 6) would give 6. Pin the order.
    const result = computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: true,
      earliestExitEpoch: BigNumber.from(600_000),
      earliestConsolidationEpoch: BigNumber.from(500_000),
      exitChurnPerEpochGwei: BigNumber.from(0),
      consolidationChurnPerEpochGwei: BigNumber.from(5),
    });

    expect(result.eq(BigNumber.from(7))).toBe(true);
  });

  it('matches the EIP-8080 motivation example: ~256 → ~688 ETH/epoch ceiling', () => {
    // The EIP cites a 2.5x improvement: from 256 ETH/epoch up to ~688 ETH/epoch under
    // current parameters. With consolidation churn of 288 ETH/epoch (the value implied
    // by the EIP's "688 = 256 + 288 × 3/2" arithmetic), the effective exit-side budget
    // should hit ~688 ETH/epoch when the exit queue is ahead.
    const consolidationChurn288 = BigNumber.from('288000000000');
    const expected = BigNumber.from('688000000000');

    const result = computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: true,
      earliestExitEpoch: BigNumber.from(600_000),
      earliestConsolidationEpoch: BigNumber.from(500_000),
      exitChurnPerEpochGwei: exitChurn256,
      consolidationChurnPerEpochGwei: consolidationChurn288,
    });

    expect(result.eq(expected)).toBe(true);
  });

  it('does not mutate input BigNumbers', () => {
    const exitIn = BigNumber.from('256000000000');
    const consolidationIn = BigNumber.from('432000000000');

    computeEffectiveExitChurnPerEpochGwei({
      isExitViaConsolidationActive: true,
      earliestExitEpoch: BigNumber.from(600_000),
      earliestConsolidationEpoch: BigNumber.from(500_000),
      exitChurnPerEpochGwei: exitIn,
      consolidationChurnPerEpochGwei: consolidationIn,
    });

    expect(exitIn.eq('256000000000')).toBe(true);
    expect(consolidationIn.eq('432000000000')).toBe(true);
  });
});
