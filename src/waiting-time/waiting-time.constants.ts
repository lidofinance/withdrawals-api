import { parseEther } from '@ethersproject/units';

export const MIN_PER_EPOCH_CHURN_LIMIT = 4;
export const CHURN_LIMIT_QUOTIENT = 65536; // 2**16

// note: currently all lido validators continues holding 32 eth,
// but after electra upgrade maximum in network increased to 2048 eth
export const MIN_ACTIVATION_BALANCE = parseEther('32'); // ETH

export const MAX_EFFECTIVE_BALANCE_ELECTRA = parseEther('2048');

export const MAX_WITHDRAWALS_PER_PAYLOAD = 2 ** 4;

export const MAX_PENDING_PARTIALS_PER_WITHDRAWALS_SWEEP = 2 ** 3;

export const GAP_AFTER_REPORT = 30 * 60 * 1000; // 30 mins

export const WITHDRAWAL_BUNKER_DELAY_FRAMES = 14;
