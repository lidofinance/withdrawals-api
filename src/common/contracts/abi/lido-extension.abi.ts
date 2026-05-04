/**
 * ABI fragment for Lido contract methods introduced in SR-3 that are not yet shipped in
 * @lido-nestjs/contracts typechain bindings. Probed at runtime; LidoExtensionReader uses
 * call success vs revert to decide whether the connected Lido contract is post-SR-3.
 *
 * Lido is behind a stable proxy (single address forever), so address-as-trigger discrimination
 * does not apply here — method-existence probe is the only signal. Once observed as supported,
 * the flag latches `true` (a protocol cannot un-deploy SR-3) to avoid flicker on transient
 * RPC failures.
 */

export const LIDO_EXTENSION_ABI = [
  {
    name: 'getDepositsReserve',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'depositsReserve', type: 'uint256' }],
  },
] as const;
