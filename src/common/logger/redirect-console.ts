/* eslint-disable no-console -- this is the one place allowed to touch console: it is what
   moves console output into the logger, which the `no-console` rule exists to enforce. */
import { format } from 'node:util';
import { LoggerService } from '@lido-nestjs/logger';

// Third-party code can log straight to `console` on failures (e.g. connection errors that
// embed a provider URL with an API key). Such output skips the central logger entirely: it
// is neither JSON nor secret-masked. Routing console.* through the logger puts it back under
// masking.
//
// Our own code must not rely on this — the `no-console` eslint rule keeps it that way.

const CONSOLE_LEVELS = {
  error: 'error',
  warn: 'warn',
  log: 'log',
  info: 'log',
  dir: 'log',
  table: 'log',
  debug: 'debug',
  trace: 'debug',
} as const;

type ConsoleMethod = keyof typeof CONSOLE_LEVELS;

/**
 * Redirects console.* to the central logger. Returns a function restoring the original console.
 */
export function redirectConsoleToLogger(logger: LoggerService): () => void {
  const originals = {} as Record<ConsoleMethod, (...args: unknown[]) => void>;
  // Winston's Console transport normally writes to the raw stream, but it falls back to
  // console.log/error when `console._stdout` is missing — guard against logging recursion.
  let insideLogger = false;

  (Object.keys(CONSOLE_LEVELS) as ConsoleMethod[]).forEach((method) => {
    originals[method] = console[method].bind(console);

    console[method] = (...args: unknown[]) => {
      if (insideLogger) {
        originals[method](...args);
        return;
      }

      insideLogger = true;
      try {
        logger[CONSOLE_LEVELS[method]](format(...args));
      } catch {
        originals[method](...args);
      } finally {
        insideLogger = false;
      }
    };
  });

  return () => {
    (Object.keys(originals) as ConsoleMethod[]).forEach((method) => {
      console[method] = originals[method];
    });
  };
}
