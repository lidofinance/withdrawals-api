import { CHAINS } from '@lido-nestjs/constants';

export const KEYS_API_PATHS = {
  [CHAINS.Mainnet]: 'https://keys-api.lido.fi',
  [CHAINS.Goerli]: 'https://keys-api.testnet.fi',
  [CHAINS.Holesky]: 'https://keys-api-holesky.testnet.fi',
  [CHAINS.Hoodi]: 'https://keys-api-hoodi.testnet.fi',
};
