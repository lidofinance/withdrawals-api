import { streamArray } from 'stream-json/streamers/StreamArray';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { batch } from 'stream-json/utils/Batch';
import { unblock } from 'common/utils/unblock';

const BATCH_SIZE = 100;

export async function processValidatorsStream(validatorsReadStream: any, batchSize = BATCH_SIZE) {
  const data = [];
  const pipeline = chain([
    validatorsReadStream,
    parser(),
    pick({ filter: 'data' }),
    streamArray(),
    batch({ batchSize }),
    async (batch) => {
      await unblock();
      for (const validator of batch) {
        data.push(validator.value);
      }
    },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  pipeline.on('data', () => {});

  await new Promise((resolve, reject) => {
    pipeline.on('error', (error) => {
      reject(error);
    });

    pipeline.on('end', async () => {
      resolve(true);
    });
  }).finally(() => pipeline.destroy());

  return data;
}
