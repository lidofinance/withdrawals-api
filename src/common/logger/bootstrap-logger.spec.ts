import { logBootstrapError } from './bootstrap-logger';

const SENTRY_DSN_FIXTURE = 'fixture-sentry-dsn';

describe('logBootstrapError', () => {
  let write: jest.SpyInstance;

  beforeEach(() => {
    process.env.SENTRY_DSN = SENTRY_DSN_FIXTURE;
    write = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    write.mockRestore();
    delete process.env.SENTRY_DSN;
  });

  it('writes one JSON error line with masked secrets', () => {
    logBootstrapError(`invalid value ${SENTRY_DSN_FIXTURE}`, 'EnvValidation');

    const entry = JSON.parse(String(write.mock.calls[0][0]));
    expect(String(write.mock.calls[0][0])).toMatch(/\n$/);
    expect(entry).toMatchObject({ level: 'error', context: 'EnvValidation' });
    expect(entry.message).not.toContain(SENTRY_DSN_FIXTURE);
  });
});
