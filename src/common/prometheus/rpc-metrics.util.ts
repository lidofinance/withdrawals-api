const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Normalizes a provider host per the RPC metrics policy: strip protocol, lowercase,
 * collapse to the registrable domain (`lb.drpc.org` -> `drpc.org`), keep IPs (with port) as-is.
 * Keeps label cardinality low across provider subdomains that route to the same vendor.
 */
export function normalizeRpcProvider(urlOrHost: string | undefined): string {
  if (!urlOrHost) return 'unknown';

  const withoutProtocol = urlOrHost.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostPort = withoutProtocol.split('/')[0];
  const [host, port] = hostPort.split(':');

  if (IPV4_HOST.test(host)) {
    return port ? `${host}:${port}` : host;
  }

  const labels = host.toLowerCase().split('.');
  return labels.length > 2 ? labels.slice(-2).join('.') : labels.join('.');
}

/** Aggregates an HTTP status into the policy's `response_code` label, e.g. 200 -> "2xx". */
export function toResponseCodeClass(status?: number): string {
  if (!status) return '';
  return `${Math.floor(status / 100)}xx`;
}

/**
 * Extracts a JSON-RPC error code (e.g. -32603) for the `rpc_error_code` label.
 * Ethers also uses `.code` for its own string error categories (SERVER_ERROR,
 * REQUEST_TIMEOUT, ...) — those aren't RPC error codes, so they're left blank.
 */
export function extractRpcErrorCode(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'number') return String(code);
  if (typeof code === 'string' && /^-?\d+$/.test(code)) return code;
  return '';
}

const DYNAMIC_PATH_SEGMENT = /^(0x[0-9a-f]+|\d+)$/i;

/**
 * Normalizes a Beacon API path for the `method` label per the RPC metrics policy:
 * replaces dynamic segments (slot/epoch/validator index, 0x-prefixed roots/pubkeys)
 * with a placeholder so state/block/validator ids don't blow up label cardinality.
 * `head`/`genesis`/`finalized`/`justified` are Beacon API's own low-cardinality
 * special ids, so they're left as-is.
 */
export function normalizeConsensusApiPath(url: string): string {
  const [pathname] = url.split('?');
  return pathname
    .split('/')
    .map((segment) => (DYNAMIC_PATH_SEGMENT.test(segment) ? '{id}' : segment))
    .join('/');
}
