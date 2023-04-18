import { BigNumber } from '@ethersproject/bignumber';

export const FAR_FUTURE_EPOCH = BigNumber.from(2).pow(64).sub(1);
export const MAX_SEED_LOOKAHEAD = 4;
