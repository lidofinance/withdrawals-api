import * as fs from 'node:fs';
import * as path from 'node:path';
import { NetworkConfig } from '../index';

export function findNetworkConfig(name: string, directory = './network-configs'): NetworkConfig {
  const fileName = `${name}.json`;
  const filePath = path.join(directory, fileName);

  if (!fs.existsSync(filePath)) {
    // Called from the ConfigService constructor, before the central logger exists.
    // eslint-disable-next-line no-console
    console.error(`Error: Custom network config "${fileName}" doesn't exists `);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error reading file ${fileName}: ${err.message}`);
    process.exit(1);
  }
}
