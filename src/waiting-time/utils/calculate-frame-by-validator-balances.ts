import { BigNumber } from '@ethersproject/bignumber';

type calculateFrameByValidatorBalancesArgs = {
  unfinilized: BigNumber;
  // Per-frame rewards rate net of the deposits-reserve refill claim — what's actually drainable
  // to withdrawals each frame after governance siphons off the per-cycle reserve target.
  rewardsAvailableForWithdrawals: BigNumber;
  currentFrame: number;
  frameBalances: Record<string, BigNumber>;
};

export const calculateFrameByValidatorBalances = (args: calculateFrameByValidatorBalancesArgs): number | null => {
  const { frameBalances, unfinilized, rewardsAvailableForWithdrawals, currentFrame } = args;
  let unfinalizedAmount = unfinilized;
  let lastFrame = BigNumber.from(currentFrame);

  const frames = Object.keys(frameBalances);
  let result: BigNumber = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const balance = frameBalances[frame];
    const framesBetween = BigNumber.from(frame).sub(lastFrame);
    let reduced = unfinalizedAmount.sub(balance);

    // consider rewards only for future frames
    if (framesBetween.gte(0)) {
      reduced = reduced.sub(framesBetween.mul(rewardsAvailableForWithdrawals));
      lastFrame = BigNumber.from(frame);
    }
    unfinalizedAmount = reduced;

    if (reduced.lte(0)) {
      result = BigNumber.from(frame);
      break;
    }
  }

  return result === null ? null : result.toNumber();
};
