import { Readable } from 'stream';
import { processJsonStreamBeaconState } from './process-json-stream-beacon-state';

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
