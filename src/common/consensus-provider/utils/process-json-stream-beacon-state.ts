import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { filter } from 'stream-json/filters/Filter';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { chain } from 'stream-chain';
import { BeaconState } from '../consensus-provider.types';

const defaultKeys = ['slot', 'next_withdrawal_validator_index', 'latest_full_slot', 'latest_withdrawals_root'] as const;

export async function processJsonStreamBeaconState(readableStream, keys: readonly string[] = defaultKeys) {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      readableStream, // Incoming ReadableStream
      parser(), // Parses JSON as a stream
      pick({ filter: 'data' }),
      // Discard unused fields before streamObject assembles their potentially large arrays.
      filter({ filter: (path) => typeof path[0] === 'string' && keys.includes(path[0]) }),
      streamObject(), // Streams key-value pairs { key, value }
    ]);

    const result = {} as BeaconState;

    pipeline.on('data', ({ key, value }) => {
      if (keys.includes(key)) {
        result[key] = value; // Store key-value pairs in an object
      }
    });

    pipeline.on('end', () => {
      resolve(result); // Resolve with the final object
    });

    pipeline.on('error', reject);
  });
}
