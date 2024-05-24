import { BigNumber } from '@ethersproject/bignumber';
import { CHAINS } from '@lido-nestjs/constants';
import { CronExpression } from '@nestjs/schedule';

export const FAR_FUTURE_EPOCH = BigNumber.from(2).pow(64).sub(1);
export const MAX_SEED_LOOKAHEAD = 4;

export const ORACLE_REPORTS_CRON_BY_CHAIN_ID = {
  [CHAINS.Mainnet]: '30 4/8 * * *', // 4 utc, 12 utc, 20 utc
  [CHAINS.Holesky]: CronExpression.EVERY_3_HOURS, // happens very often, not necessary sync in testnet
};
