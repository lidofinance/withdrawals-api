import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { DevnetConfig } from '../devnets';

export async function findDevnetConfig(name: string, directory = './devnet-configs'): Promise<DevnetConfig> {
  try {
    const files = await readdir(directory);

    for (const file of files) {
      if (extname(file) === '.json') {
        const filePath = join(directory, file);

        try {
          const content = await readFile(filePath, 'utf8');
          const json = JSON.parse(content);

          if (json.name === name) {
            return json;
          }
        } catch (err) {
          console.error(`Error reading file ${file}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error ready directory: ${err.message}`);
  }

  return null;
}
