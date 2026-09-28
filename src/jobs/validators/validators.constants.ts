import { CHAINS } from '@lido-nestjs/constants';

export const MAX_SEED_LOOKAHEAD = 4;

// Used only until the VEBO frame config is read from chain and rebuilds the schedule.
export const FALLBACK_VALIDATOR_UPDATE_CRONS_BY_CHAIN_ID = {
  [CHAINS.Mainnet]: ['54 2 * * *', '42 7 * * *', '30 12 * * *', '18 17 * * *', '6 22 * * *'],
  [CHAINS.Hoodi]: ['57 2 * * *', '45 7 * * *', '33 12 * * *', '21 17 * * *', '9 22 * * *'],
};

export const WITHDRAWALS_VALIDATORS_PER_SLOT = 16;
