export const CONSENSUS_POOL_INTERVAL_MS = 10_000;

export const CONSENSUS_RETRY_DELAY = 1_000;
export const CONSENSUS_RETRY_ATTEMPTS = 3;

export const CONSENSUS_REQUEST_TIMEOUT = 1800_000;

export const API_GET_STATE_URL = (stateId: string) => `/eth/v2/debug/beacon/states/${stateId}`;
