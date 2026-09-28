import type { EnvironmentVariables } from './env.validation';

// Values that must never be written by code that runs before ConfigService is available.
export const SECRET_ENV_KEYS: (keyof EnvironmentVariables)[] = ['SENTRY_DSN', 'CL_API_URLS', 'EL_RPC_URLS'];
