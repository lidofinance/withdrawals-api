import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from '../genesis-time';

export const HEALTH_URL = 'health';

export const MAX_BLOCK_DELAY_SECONDS = 5 * 60;
export const MAX_MEMORY_HEAP = 1024 * 1024 * 1024 * 4; // 4 GB

export const MAX_BLOCK_DELAY_CONSENSUS_SECONDS = 2 * SLOTS_PER_EPOCH * SECONDS_PER_SLOT;
