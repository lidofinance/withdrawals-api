import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LoggerService } from '@nestjs/common';

import { registerSecretsRotationRestart } from './secrets-rotation';

const CONTENT_V1 = 'export PROVIDER_URL="v1"\n';
const CONTENT_V2 = 'export PROVIDER_URL="v2"\n';

// Real timers + tight poll interval: fs.watchFile stat-polls the path, fake
// timers would freeze it.
const WATCH_INTERVAL_MS = 20;

// Give fs.watchFile time to start before changing the file.
// Otherwise, the test may miss the first update and become flaky.
const waitForWatchToStart = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, WATCH_INTERVAL_MS * 2));
};

const waitFor = async (assertion: () => void, timeoutMs = 5_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
};

// Mirror the agent's atomic update: write a temp file, rename over the path (new inode).
const atomicWrite = (path: string, content: string): void => {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
};

describe('registerSecretsRotationRestart', () => {
  const logger: LoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  let dir: string;
  let file: string;
  let stopWatch: (() => void) | null = null;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'secrets-rotation-'));
    file = join(dir, 'app');
    process.env.SECRETS_FILE = file;
  });

  afterEach(() => {
    stopWatch?.();
    stopWatch = null;
    rmSync(dir, { recursive: true, force: true });
    delete process.env.SECRETS_FILE;
    jest.clearAllMocks();
  });

  it('is a no-op when no secrets file is injected (default path absent)', () => {
    delete process.env.SECRETS_FILE;
    const close = jest.fn();
    stopWatch = registerSecretsRotationRestart({ close }, logger, {
      intervalMs: WATCH_INTERVAL_MS,
    });
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('throws when SECRETS_FILE is explicitly set but unreadable', () => {
    process.env.SECRETS_FILE = join(dir, 'nope');
    const close = jest.fn();
    expect(() => registerSecretsRotationRestart({ close }, logger)).toThrow();
  });

  it('closes the app and exits 0 when the file content changes (atomic rename)', async () => {
    writeFileSync(file, CONTENT_V1);
    const close = jest.fn().mockResolvedValue(undefined);
    const exit = jest.fn();
    stopWatch = registerSecretsRotationRestart({ close }, logger, {
      intervalMs: WATCH_INTERVAL_MS,
      exit,
    });

    await waitForWatchToStart();

    atomicWrite(file, CONTENT_V2);
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('still exits 0 when close rejects', async () => {
    writeFileSync(file, CONTENT_V1);
    const close = jest.fn().mockRejectedValue(new Error('boom'));
    const exit = jest.fn();
    stopWatch = registerSecretsRotationRestart({ close }, logger, {
      intervalMs: WATCH_INTERVAL_MS,
      exit,
    });

    await waitForWatchToStart();

    atomicWrite(file, CONTENT_V2);
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(logger.error).toHaveBeenCalled();
  });

  it('force-exits when close hangs', async () => {
    writeFileSync(file, CONTENT_V1);
    const close = jest.fn().mockReturnValue(new Promise<void>(() => undefined));
    const exit = jest.fn();
    stopWatch = registerSecretsRotationRestart({ close }, logger, {
      intervalMs: WATCH_INTERVAL_MS,
      forceExitMs: 50,
      exit,
    });

    await waitForWatchToStart();

    atomicWrite(file, CONTENT_V2);
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(logger.error).toHaveBeenCalled();
  });

  it('does not restart when the file is rewritten with identical content', async () => {
    writeFileSync(file, CONTENT_V1);
    const close = jest.fn();
    const exit = jest.fn();
    stopWatch = registerSecretsRotationRestart({ close }, logger, {
      intervalMs: WATCH_INTERVAL_MS,
      exit,
    });

    await waitForWatchToStart();

    atomicWrite(file, CONTENT_V1);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(close).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('survives a delete+recreate window: keeps running, restarts on the new content', async () => {
    writeFileSync(file, CONTENT_V1);
    const close = jest.fn().mockResolvedValue(undefined);
    const exit = jest.fn();
    stopWatch = registerSecretsRotationRestart({ close }, logger, {
      intervalMs: WATCH_INTERVAL_MS,
      exit,
    });

    await waitForWatchToStart();

    rmSync(file);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(exit).not.toHaveBeenCalled();

    writeFileSync(file, CONTENT_V2);
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
