import { BigNumber } from '@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import { CHAINS } from '@lido-nestjs/constants';

export const GENESIS_TIME_BY_CHAIN: { [key in Partial<CHAINS>]?: number } = {
  [CHAINS.Mainnet]: 1606824023,
  [CHAINS.Goerli]: 1616508000,
  [CHAINS.Zhejiang]: 1675782000,
};

export const MIN_PER_EPOCH_CHURN_LIMIT = 4;
export const CHURN_LIMIT_QUOTIENT = 65536; // 2**16

export const MAX_EFFECTIVE_BALANCE = parseEther('32'); // ETH

export const FAR_FUTURE_EPOCH = BigNumber.from(2).pow(64).sub(1);

export const MAX_SEED_LOOKAHEAD = 4;
export const MAX_WITHDRAWALS_PER_PAYLOAD = 2 ** 4;
export const SLOTS_IN_EPOCH = 32;
export const SECONDS_IN_SLOT = 12;
// const MIN_VALIDATOR_WITHDRAWABILITY_DELAY = 256;
