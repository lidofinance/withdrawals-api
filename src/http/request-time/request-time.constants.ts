import { parseEther } from '@ethersproject/units';

export const MIN_PER_EPOCH_CHURN_LIMIT = 4;
export const CHURN_LIMIT_QUOTIENT = 65536; // 2**16

export const MAX_EFFECTIVE_BALANCE = parseEther('32'); // ETH

export const MAX_WITHDRAWALS_PER_PAYLOAD = 2 ** 4;
// const MIN_VALIDATOR_WITHDRAWABILITY_DELAY = 256;
export const MAX_VALID_NUMBER = Number.MAX_SAFE_INTEGER;

export const GAP_AFTER_REPORT = 30 * 60 * 1000; // 30 mins
