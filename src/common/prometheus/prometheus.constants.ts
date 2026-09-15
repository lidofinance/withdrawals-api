import { APP_NAME } from 'app/app.constants';

export const METRICS_URL = 'metrics';
export const METRICS_PREFIX = `${APP_NAME.replace(/-|\ /g, '_')}_`;

/** `network` label value for the RPC metrics policy; this app only talks to Ethereum L1. */
export const RPC_NETWORK_NAME = 'ethereum';
