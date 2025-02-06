import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { chain } from 'stream-chain';
import { BeaconState } from '../consensus-provider.types';

const keys = ['slot', 'pending_partial_withdrawals', 'validators', 'balances'] as const;

export async function processJsonStreamBeaconState(readableStream) {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      readableStream, // Incoming ReadableStream
      parser(), // Parses JSON as a stream
      pick({ filter: 'data' }),
      streamObject(), // Streams key-value pairs { key, value }
    ]);

    const result = {} as BeaconState;

    pipeline.on('data', ({ key, value }) => {
      console.log('key', key);
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
