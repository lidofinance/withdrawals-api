import { BigNumber } from '@ethersproject/bignumber';

import { calculateSweepingMean } from './calculate-sweeping-mean';

type calculateFrameByValidatorBalancesArgs = {
  unfinilized: BigNumber;
  totalValidators: number;
  frameBalances: Record<string, BigNumber>;
  epochPerFrame: number;
};

export const calculateFrameByValidatorBalances = (args: calculateFrameByValidatorBalancesArgs): number | null => {
  const { frameBalances, unfinilized, totalValidators, epochPerFrame } = args;
  let unfinalizedAmount = unfinilized;

  const frames = Object.keys(frameBalances);
  let result = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const balance = frameBalances[frame];
    const reduced = unfinalizedAmount.sub(balance);

    if (reduced.lte(0)) result = BigNumber.from(frame);
    else unfinalizedAmount = reduced;
  }

  if (result === null) return null;

  const sweepingMean = calculateSweepingMean(totalValidators).toNumber();
  const framesOfSweepingMean = Math.ceil(sweepingMean / epochPerFrame);

  return result.add(framesOfSweepingMean).toNumber();
};
