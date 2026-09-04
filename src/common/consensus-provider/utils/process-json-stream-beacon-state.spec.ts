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
        execution_payload_availability: '0x01',
        builder_pending_withdrawals: [],
      },
    });
    const expected = {
      slot: '100',
      next_withdrawal_validator_index: '42',
      execution_payload_availability: '0x01',
      builder_pending_withdrawals: [],
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


describe('processJsonStreamBeaconState', () => {
  it('keeps only sweep fields selected by default', async () => {
    const stream = Readable.from([
      JSON.stringify({
        data: {
          slot: '3200',
          next_withdrawal_validator_index: '42',
          execution_payload_availability: '0x01',
          builder_pending_withdrawals: [{ builder_index: '1' }, { builder_index: '2' }],
          builders: [
            { withdrawable_epoch: '99', balance: '1' },
            { withdrawable_epoch: '100', balance: '32000000000' },
            { withdrawable_epoch: '101', balance: '32000000000' },
            { withdrawable_epoch: '20', balance: '0' },
            { withdrawable_epoch: '18446744073709551615', balance: '32000000000' },
          ],
        },
      }),
    ]);

    await expect(processJsonStreamBeaconState(stream)).resolves.toEqual({
      slot: '3200',
      next_withdrawal_validator_index: '42',
      execution_payload_availability: '0x01',
      builder_pending_withdrawals: [{ builder_index: '1' }, { builder_index: '2' }],
    });
  });

  it('omits builders for a pre-Gloas beacon state', async () => {
    const stream = Readable.from([
      JSON.stringify({
        data: {
          slot: '3200',
          next_withdrawal_validator_index: '42',
        },
      }),
    ]);

    await expect(processJsonStreamBeaconState(stream)).resolves.toEqual({
      slot: '3200',
      next_withdrawal_validator_index: '42',
    });
  });

  it('rejects malformed JSON without leaving a stream branch open', async () => {
    const stream = Readable.from(['{"data":']);

    await expect(processJsonStreamBeaconState(stream)).rejects.toThrow();
    expect(stream.destroyed).toBe(true);
  });

  it('propagates source errors and closes the source', async () => {
    const stream = Readable.from(
      (async function* () {
        yield '{"data":{"slot":"3200",';
        throw new Error('connection closed');
      })(),
    );

    await expect(processJsonStreamBeaconState(stream)).rejects.toThrow('connection closed');
    expect(stream.destroyed).toBe(true);
  });

  it('preserves selected empty arrays and nested values', async () => {
    const stream = Readable.from([
      JSON.stringify({ data: { builders: [{ balance: '1' }], builder_pending_withdrawals: [], slot: '3200' } }),
    ]);

    await expect(processJsonStreamBeaconState(stream, ['builders', 'builder_pending_withdrawals'])).resolves.toEqual({
      builders: [{ balance: '1' }],
      builder_pending_withdrawals: [],
    });
  });
});
