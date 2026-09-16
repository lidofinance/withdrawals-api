import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from '../genesis-time/genesis-time.constants';

// TODO:
//  During the migration from the old infrastructure to k8s,
//  we'll keep the existing /health endpoint for compatibility.
//  In the future, it will most likely be renamed to /readyz to better reflect its semantics.
export const HEALTH_URL = 'health';
export const LIVEZ_URL = 'livez';

export const MAX_BLOCK_DELAY_SECONDS = 5 * 60;
export const MAX_MEMORY_HEAP = 1024 * 1024 * 1024 * 4; // 4 GB

export const MAX_BLOCK_DELAY_CONSENSUS_SECONDS = 2 * SLOTS_PER_EPOCH * SECONDS_PER_SLOT;
// VEBO refreshes validator data every 4.8 hours; allow a 1.2-hour grace period.
export const MAX_VALIDATORS_DATA_DELAY_SECONDS = 6 * 60 * 60;
// Withdrawable Lido validator balances are refreshed every 30 minutes; allow one missed refresh.
export const MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS = 60 * 60;
