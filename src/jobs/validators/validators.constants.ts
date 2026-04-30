import { CHAINS } from '@lido-nestjs/constants';

export const MAX_SEED_LOOKAHEAD = 4;

export const ORACLE_REPORTS_CRON_BY_CHAIN_ID = {
  // 45-epoch VEBO frame anchored at 12:00 UTC, refreshed +30m after each report.
  [CHAINS.Mainnet]: ['54 2 * * *', '42 7 * * *', '30 12 * * *', '18 17 * * *', '6 22 * * *'],
  [CHAINS.Hoodi]: ['54 2 * * *', '42 7 * * *', '30 12 * * *', '18 17 * * *', '6 22 * * *'],
};

export const WITHDRAWALS_VALIDATORS_PER_SLOT = 16;
