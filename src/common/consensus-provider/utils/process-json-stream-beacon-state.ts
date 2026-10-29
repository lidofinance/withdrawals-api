import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { filter } from 'stream-json/filters/Filter';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { chain } from 'stream-chain';
import { BeaconState } from '../consensus-provider.types';

const defaultKeys = [
  'slot',
  'next_withdrawal_validator_index',
  'builder_pending_withdrawals',
  'execution_payload_availability',
] as const;

export async function processJsonStreamBeaconState(readableStream, keys: readonly string[] = defaultKeys) {
  const pipeline = chain([
    readableStream,
    parser(),
    pick({ filter: 'data' }),
    // Discard unused fields before assembling potentially large registry arrays.
    filter({ filter: (path) => keys.includes(String(path[0])) }),
    streamObject(),
  ]);
  const result = {} as BeaconState;

  try {
    for await (const { key, value } of pipeline) {
      result[key] = value;
    }
    return result;
  } finally {
    pipeline.destroy();
    pipeline.streams.forEach((stream) => stream.destroy());
  }
}
