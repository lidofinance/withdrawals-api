import { readFileSync, unwatchFile, watchFile } from 'node:fs';
import { LoggerService } from '@nestjs/common';
import { sanitizeError } from 'common/errors';

// If graceful close hangs (stuck DB pool, external requests), force-exit:
// staying alive with stale secrets is worse than a hard restart.
const FORCE_EXIT_TIMEOUT_MS = 10_000;
const DEFAULT_SECRETS_FILE = '/vault/secrets/app';
const POLL_INTERVAL_MS = 10_000;

interface Closeable {
  close: () => Promise<void>;
}

interface SecretsRotationOptions {
  intervalMs?: number;
  forceExitMs?: number;
  exit?: (code: number) => void;
}

/**
 * OpenBao rotation restart. Secrets arrive as an env-export file that the
 * chart's container command sources before exec; the agent sidecar keeps it
 * fresh via atomic rename but has no signal path into this container (no
 * shared PID namespace), so the app must detect rotation itself: poll the file
 * BY PATH (fs.watchFile — inotify would attach to the old inode and go silent
 * after the first rename) and restart-by-exit on a content change: close the
 * Nest app gracefully and exit 0; `restartPolicy: Always` brings it back up and
 * the startup command re-sources the refreshed file.
 *
 * Path from SECRETS_FILE, default /vault/secrets/app. File absent at the
 * default path = no injector (local dev) → no-op; SECRETS_FILE set but
 * unreadable = broken deployment → throw. Returns a stop function (tests).
 */
export function registerSecretsRotationRestart(
  app: Closeable,
  logger: LoggerService,
  options: SecretsRotationOptions = {},
): () => void {
  const {
    intervalMs = POLL_INTERVAL_MS,
    forceExitMs = FORCE_EXIT_TIMEOUT_MS,
    exit = (code) => process.exit(code),
  } = options;
  const path = process.env.SECRETS_FILE ?? DEFAULT_SECRETS_FILE;

  let lastContent: string;
  try {
    lastContent = readFileSync(path, 'utf8');
  } catch (error: unknown) {
    if (process.env.SECRETS_FILE) throw error;
    return () => undefined;
  }
  logger.log?.(`Watching secrets file ${path} for rotation`);

  let restarting = false;
  const restart = (): void => {
    if (restarting) return;
    restarting = true;
    logger.log?.('Secrets file changed: rotated credentials, restarting to pick up new values');

    const forceExitTimer = setTimeout(() => {
      logger.error?.(`Graceful close timed out after ${forceExitMs}ms, forcing exit`);
      exit(0);
    }, forceExitMs);

    app
      .close()
      .catch((error: unknown) => {
        logger.error?.('Graceful close on secrets rotation failed', sanitizeError(error));
      })
      .finally(() => {
        clearTimeout(forceExitTimer);
        exit(0);
      });
  };

  const listener = (): void => {
    let raw: string;
    try {
      raw = readFileSync(path, 'utf8');
    } catch (error: unknown) {
      // Transient (sidecar restart / delete+recreate window): retry ourselves —
      // watchFile won't re-fire for a stat it has already seen, so a failed read
      // here would otherwise strand the process on stale creds until the NEXT
      // rotation.
      logger.warn?.(`Secrets file ${path} unreadable, retrying`, sanitizeError(error));
      setTimeout(listener, Math.min(intervalMs, 5_000)).unref();
      return;
    }
    if (raw === lastContent) return;
    lastContent = raw;
    restart();
  };

  watchFile(path, { interval: intervalMs }, listener).unref();
  return () => unwatchFile(path, listener);
}
