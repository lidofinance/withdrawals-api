import {
  extractRpcErrorCode,
  normalizeConsensusApiPath,
  normalizeRpcProvider,
  toResponseCodeClass,
} from './rpc-metrics.util';

describe('normalizeRpcProvider', () => {
  it.each([
    ['https://lb.drpc.org', 'drpc.org'],
    ['https://eth-holesky.g.alchemy.com', 'alchemy.com'],
    ['http://192.168.0.1', '192.168.0.1'],
    ['http://192.168.0.1:8545', '192.168.0.1:8545'],
    ['https://ETH-MAINNET.G.ALCHEMY.COM/v2/key', 'alchemy.com'],
    ['localhost', 'localhost'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeRpcProvider(input)).toBe(expected);
  });

  it.each([undefined, ''])('returns "unknown" for %p instead of throwing', (input) => {
    expect(normalizeRpcProvider(input)).toBe('unknown');
  });
});

describe('toResponseCodeClass', () => {
  it.each([
    [200, '2xx'],
    [404, '4xx'],
    [503, '5xx'],
    [undefined, ''],
    [0, ''],
  ])('maps %s to %s', (status, expected) => {
    expect(toResponseCodeClass(status)).toBe(expected);
  });
});

describe('extractRpcErrorCode', () => {
  it('reads a numeric JSON-RPC error code', () => {
    expect(extractRpcErrorCode({ code: -32603 })).toBe('-32603');
  });

  it('reads a numeric-string JSON-RPC error code', () => {
    expect(extractRpcErrorCode({ code: '-32000' })).toBe('-32000');
  });

  it('ignores ethers-style string error categories', () => {
    expect(extractRpcErrorCode({ code: 'SERVER_ERROR' })).toBe('');
  });

  it('returns empty string when there is no code', () => {
    expect(extractRpcErrorCode(new Error('boom'))).toBe('');
  });
});

describe('normalizeConsensusApiPath', () => {
  it('replaces a numeric state id', () => {
    expect(normalizeConsensusApiPath('/eth/v1/beacon/states/12345678/validators')).toBe(
      '/eth/v1/beacon/states/{id}/validators',
    );
  });

  it('replaces a 0x-prefixed block root', () => {
    expect(normalizeConsensusApiPath('/eth/v2/beacon/blocks/0xabc123')).toBe('/eth/v2/beacon/blocks/{id}');
  });

  it('keeps low-cardinality special ids as-is', () => {
    expect(normalizeConsensusApiPath('/eth/v2/beacon/blocks/head')).toBe('/eth/v2/beacon/blocks/head');
  });

  it('strips query strings', () => {
    expect(normalizeConsensusApiPath('/eth/v1/beacon/headers?slot=123')).toBe('/eth/v1/beacon/headers');
  });
});
