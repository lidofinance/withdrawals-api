import { CHAINS } from '@lido-nestjs/constants';

export const MAX_SEED_LOOKAHEAD = 4;

export const ORACLE_REPORTS_CRON_BY_CHAIN_ID = {
  [CHAINS.Mainnet]: '30 4/8 * * *', // 4 utc, 12 utc, 20 utc
  [CHAINS.Hoodi]: ['54 2 * * *', '42 7 * * *', '30 12 * * *', '18 17 * * *', '6 22 * * *'],
};

export const WITHDRAWALS_VALIDATORS_PER_SLOT = 16;
