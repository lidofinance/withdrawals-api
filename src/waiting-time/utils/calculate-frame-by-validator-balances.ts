import { BigNumber } from '@ethersproject/bignumber';

import { calculateSweepingMean } from './calculate-sweeping-mean';

type calculateFrameByValidatorBalancesArgs = {
  unfinilized: BigNumber;
  rewardsPerFrame: BigNumber;
  currentFrame: number;
  totalValidators: number;
  frameBalances: Record<string, BigNumber>;
  epochPerFrame: number;
};

export const calculateFrameByValidatorBalances = (args: calculateFrameByValidatorBalancesArgs): number | null => {
  const { frameBalances, unfinilized, totalValidators, epochPerFrame, rewardsPerFrame, currentFrame } = args;
  let unfinalizedAmount = unfinilized;
  let lastFrame = BigNumber.from(currentFrame);

  const frames = Object.keys(frameBalances);
  let result = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const balance = frameBalances[frame];
    const framesBetween = BigNumber.from(frame).sub(lastFrame);
    let reduced = unfinalizedAmount.sub(balance);

    // consider rewards only for future frames
    if (framesBetween.gte(0)) {
      reduced = reduced.sub(framesBetween.mul(rewardsPerFrame));
      lastFrame = BigNumber.from(frame);
    }
    unfinalizedAmount = reduced;

    if (reduced.lte(0)) {
      result = BigNumber.from(frame);
      break;
    }
  }

  if (result === null) return null;

  const sweepingMean = calculateSweepingMean(totalValidators).toNumber();
  const framesOfSweepingMean = Math.ceil(sweepingMean / epochPerFrame);

  const resultFrame = result.add(framesOfSweepingMean).toNumber();

  // If withdrawable_epoch is less than current frame, should return next frame
  return resultFrame < currentFrame ? currentFrame + 1 : resultFrame;
};
