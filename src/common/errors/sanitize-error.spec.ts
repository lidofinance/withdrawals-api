import { sanitizeError, SanitizedError } from 'common/errors';

// ---------------------------------------------------------------------------
// sanitizeError
// ---------------------------------------------------------------------------

describe('sanitizeError', () => {
  // -------------------------------------------------------------------------
  // Error instance
  // -------------------------------------------------------------------------

  it('returns name, message, and stack for a plain Error', () => {
    const err = new Error('something went wrong');
    const result = sanitizeError(err);

    expect(result.name).toBe('Error');
    expect(result.message).toBe('something went wrong');
    expect(typeof result.stack).toBe('string');
  });

  it('preserves the subclass name for TypeError', () => {
    const err = new TypeError('bad type');
    const result = sanitizeError(err);
    expect(result.name).toBe('TypeError');
    expect(result.message).toBe('bad type');
  });

  it('preserves the subclass name for RangeError', () => {
    const err = new RangeError('out of range');
    const result = sanitizeError(err);
    expect(result.name).toBe('RangeError');
  });

  it('preserves the name of a custom Error subclass', () => {
    class NetworkError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'NetworkError';
      }
    }
    const err = new NetworkError('timeout');
    const result = sanitizeError(err);
    expect(result.name).toBe('NetworkError');
    expect(result.message).toBe('timeout');
  });

  // -------------------------------------------------------------------------
  // Non-Error types
  // -------------------------------------------------------------------------

  it('wraps a string with name NonError', () => {
    const result = sanitizeError('oops');
    expect(result.name).toBe('NonError');
    expect(result.message).toBe('oops');
    expect(result.stack).toBeUndefined();
  });

  it('wraps a plain object via JSON.stringify', () => {
    const result = sanitizeError({ code: 404, detail: 'not found' });
    expect(result.name).toBe('NonError');
    expect(result.message).toBe('{"code":404,"detail":"not found"}');
  });

  it('wraps null', () => {
    const result = sanitizeError(null);
    expect(result.name).toBe('NonError');
    expect(result.message).toBe('null');
  });

  it('wraps undefined as the string "undefined"', () => {
    const result = sanitizeError(undefined);
    expect(result.name).toBe('NonError');
    expect(result.message).toBe('undefined');
  });

  it('wraps a number', () => {
    const result = sanitizeError(42);
    expect(result.name).toBe('NonError');
    expect(result.message).toBe('42');
  });

  it('wraps a boolean', () => {
    const result = sanitizeError(false);
    expect(result.name).toBe('NonError');
    expect(result.message).toBe('false');
  });

  // -------------------------------------------------------------------------
  // No extra properties leak through
  // -------------------------------------------------------------------------

  it('does not include extra properties from an Error with extra fields', () => {
    const err = new Error('fail') as Error & {
      authorization?: string;
      headers?: object;
    };
    err.authorization = 'Bearer secret-token';
    err.headers = { 'x-api-key': 'supersecret' };

    const result = sanitizeError(err) as unknown as Record<string, unknown>;

    expect(Object.keys(result).sort()).toEqual(['message', 'name', 'stack'].sort());
    expect(result['authorization']).toBeUndefined();
    expect(result['headers']).toBeUndefined();
  });

  it('does not include extra properties from a plain object', () => {
    const result = sanitizeError({
      sensitiveField: 'supersecret',
      code: 500,
    }) as unknown as Record<string, unknown>;

    // Result is a SanitizedError shape — no raw keys from the input object
    expect(Object.keys(result).sort()).toEqual(['message', 'name'].sort());
  });

  // -------------------------------------------------------------------------
  // Return type shape
  // -------------------------------------------------------------------------

  it('always returns name and message as strings, regardless of input', () => {
    const inputs: unknown[] = [new Error('e'), 'str', 42, null, undefined, {}, []];
    for (const input of inputs) {
      const result = sanitizeError(input);
      expect(typeof result.name).toBe('string');
      expect(typeof result.message).toBe('string');
    }
  });

  it('satisfies the SanitizedError interface', () => {
    const result: SanitizedError = sanitizeError(new Error('test'));
    expect(result).toBeDefined();
  });
});
