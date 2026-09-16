import { satanizer, commonPatterns } from '@lidofinance/satanizer';
import { SECRET_ENV_KEYS } from 'common/config/env.secrets';

// Environment validation runs before the Nest container and its logger exist.
let mask: (<T>(input: T) => T) | null = null;

const getMask = () => {
  if (mask) return mask;

  const secrets = SECRET_ENV_KEYS.map((key) => process.env[key]).filter((value): value is string => !!value);
  mask = satanizer([...commonPatterns, ...secrets]);

  return mask;
};

export const logBootstrapError = (message: string, context: string): void => {
  process.stderr.write(`${JSON.stringify({ level: 'error', context, message: getMask()(message) })}\n`);
};
