import { CHAINS } from '@lido-nestjs/constants';

export const KEYS_API_ADDRESS = {
  [CHAINS.Mainnet]: 'https://keys-api.mainnet.fi/v1/keys?used=true',
  [CHAINS.Goerli]: 'https://keys-api.testnet.fi/v1/keys?used=true',
};
