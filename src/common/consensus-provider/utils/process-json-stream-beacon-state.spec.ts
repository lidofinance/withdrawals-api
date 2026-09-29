import { Readable } from 'node:stream';
import * as streamObjectModule from 'stream-json/streamers/StreamObject';
import { processJsonStreamBeaconState } from './process-json-stream-beacon-state';

describe('processJsonStreamBeaconState', () => {
  afterEach(() => jest.restoreAllMocks());

  it('discards unused fields before assembling their values', async () => {
    const assembledKeys: string[] = [];
    const streamObject = streamObjectModule.streamObject;
    jest.spyOn(streamObjectModule, 'streamObject').mockImplementation((options) => {
      const stream = streamObject(options);
      stream.on('data', ({ key }) => assembledKeys.push(key));
      return stream;
    });
    const input = JSON.stringify({
      version: 'electra',
      data: {
        slot: '100',
        validators: [{ pubkey: '0x1234', slot: '999' }],
        next_withdrawal_validator_index: '42',
        balances: ['32000000000'],
        latest_full_slot: '99',
        latest_withdrawals_root: '0xabcd',
      },
    });
    const expected = {
      slot: '100',
      next_withdrawal_validator_index: '42',
      latest_full_slot: '99',
      latest_withdrawals_root: '0xabcd',
    };
    const chunks = Array.from({ length: Math.ceil(input.length / 7) }, (_, i) => input.slice(i * 7, (i + 1) * 7));

    await expect(processJsonStreamBeaconState(Readable.from(chunks))).resolves.toEqual(expected);
    expect(assembledKeys).toEqual(Object.keys(expected));
  });

  it('supports selecting a custom field including its nested values', async () => {
    const selected = { nested: ['1', '2'] };
    const input = Readable.from([JSON.stringify({ data: { slot: '100', selected } })]);

    await expect(processJsonStreamBeaconState(input, ['selected'])).resolves.toEqual({ selected });
  });

  it('returns an empty object when none of the selected fields is present', async () => {
    const input = Readable.from(['{"data":{"validators":[],"balances":[]}}']);

    await expect(processJsonStreamBeaconState(input)).resolves.toEqual({});
  });

  it('rejects malformed JSON even in a discarded field', async () => {
    const input = Readable.from(['{"data":{"slot":"100","validators":[}']);

    await expect(processJsonStreamBeaconState(input)).rejects.toThrow();
  });
});
