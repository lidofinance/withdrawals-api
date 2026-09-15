/* eslint-disable no-console -- exercising console.* is the point of these tests. */
import { LoggerService } from '@lido-nestjs/logger';

import { redirectConsoleToLogger } from './redirect-console';

// ---------------------------------------------------------------------------
// redirectConsoleToLogger
//
// Third-party console.* output (e.g. a client library printing a provider URL with an api
// key) must end up in the central logger, which is what applies secret masking and JSON
// formatting.
// ---------------------------------------------------------------------------

describe('redirectConsoleToLogger', () => {
  let logger: { error: jest.Mock; warn: jest.Mock; log: jest.Mock; debug: jest.Mock };
  let restore: () => void;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() };
    restore = redirectConsoleToLogger(logger as unknown as LoggerService);
  });

  afterEach(() => {
    restore();
  });

  it('routes console.error to logger.error', () => {
    console.error('Used URL: https://cl.example.com/cl-key');

    expect(logger.error).toHaveBeenCalledWith('Used URL: https://cl.example.com/cl-key');
  });

  it('maps console levels onto logger levels', () => {
    console.warn('w');
    console.info('i');
    console.log('l');
    console.debug('d');

    expect(logger.warn).toHaveBeenCalledWith('w');
    expect(logger.log).toHaveBeenCalledWith('i');
    expect(logger.log).toHaveBeenCalledWith('l');
    expect(logger.debug).toHaveBeenCalledWith('d');
  });

  it('formats multiple arguments the way console does', () => {
    console.error('failed for %s:', 'provider', { attempt: 2 });

    expect(logger.error).toHaveBeenCalledWith('failed for provider: { attempt: 2 }');
  });

  it('falls back to the original console when the logger throws', () => {
    // re-wire on top of a silenced console so the fallback output does not pollute the run
    restore();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const restoreRedirect = redirectConsoleToLogger(logger as unknown as LoggerService);
    logger.error.mockImplementation(() => {
      throw new Error('transport is down');
    });

    expect(() => console.error('still printed')).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('still printed');

    restoreRedirect();
    consoleSpy.mockRestore();
    restore = () => undefined;
  });

  it('restores the original console methods', () => {
    const patched = console.error;
    restore();

    expect(console.error).not.toBe(patched);
    logger.error.mockClear();
    // no longer redirected
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    console.error('direct');
    expect(logger.error).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
