export const SLOTS_PER_HISTORICAL_ROOT = 8192;

/**
 * Counts the run of consecutive slots with an unavailable execution payload ending at `slot`.
 *
 * Gloas (EIP-7732) tracks payload availability in the beacon state as
 * `execution_payload_availability` — an SSZ Bitvector[SLOTS_PER_HISTORICAL_ROOT] serialized as
 * a hex string, LSB-first within each byte. The bit at `slot % SLOTS_PER_HISTORICAL_ROOT` is
 * cleared when the slot's bid is processed and set to 1 once the payload envelope is processed,
 * so at a fresh head the run is usually 1 (the head's own envelope is still in flight).
 *
 * Returns 0 when the field is absent (pre-Gloas states) or malformed.
 */
export function countUnavailablePayloadSlots(slot: number, availabilityHex?: string): number {
  if (!availabilityHex || !Number.isFinite(slot) || slot < 0) {
    return 0;
  }

  const bytes = Buffer.from(availabilityHex.replace(/^0x/, ''), 'hex');
  if (bytes.length * 8 < SLOTS_PER_HISTORICAL_ROOT) {
    return 0;
  }

  const bitAt = (index: number) => (bytes[Math.floor(index / 8)] >> index % 8) & 1;

  // the vector only holds the last SLOTS_PER_HISTORICAL_ROOT slots; older bits are overwritten
  const maxRun = Math.min(SLOTS_PER_HISTORICAL_ROOT, slot + 1);
  let run = 0;
  while (run < maxRun && bitAt((slot - run) % SLOTS_PER_HISTORICAL_ROOT) === 0) {
    run++;
  }

  return run;
}
