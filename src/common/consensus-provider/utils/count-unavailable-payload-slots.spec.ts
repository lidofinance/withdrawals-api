import { countUnavailablePayloadSlots, SLOTS_PER_HISTORICAL_ROOT } from './count-unavailable-payload-slots';

describe('countUnavailablePayloadSlots', () => {
  const makeVector = (clearedBits: number[] = []): string => {
    const bytes = Buffer.alloc(SLOTS_PER_HISTORICAL_ROOT / 8, 0xff);
    for (const bit of clearedBits) {
      bytes[Math.floor(bit / 8)] &= ~(1 << bit % 8);
    }
    return '0x' + bytes.toString('hex');
  };

  it('returns 0 when the field is absent (pre-Gloas state)', () => {
    expect(countUnavailablePayloadSlots(85206, undefined)).toBe(0);
  });

  it('returns 0 when the payload of the head slot is available', () => {
    expect(countUnavailablePayloadSlots(85206, makeVector())).toBe(0);
  });

  it('counts the run of unavailable slots ending at head, LSB-first within bytes', () => {
    const slot = 85206; // bit index 85206 % 8192 = 3286
    const vector = makeVector([3286, 3285, 3284]);

    expect(countUnavailablePayloadSlots(slot, vector)).toBe(3);
    // a hole before an available slot does not extend the run
    expect(countUnavailablePayloadSlots(slot - 4, vector)).toBe(0);
  });

  it('wraps around the circular vector boundary', () => {
    // head at bit 1, run extends through bit 0 back to bit 8191
    const vector = makeVector([1, 0, SLOTS_PER_HISTORICAL_ROOT - 1]);

    expect(countUnavailablePayloadSlots(SLOTS_PER_HISTORICAL_ROOT + 1, vector)).toBe(3);
  });

  it('never counts more slots than the chain has', () => {
    const vector = makeVector([0, 1, 2, 3, 4, 5, 6, 7]);

    expect(countUnavailablePayloadSlots(2, vector)).toBe(3);
  });

  it('returns 0 on a malformed vector', () => {
    expect(countUnavailablePayloadSlots(85206, '0xff')).toBe(0);
  });
});
