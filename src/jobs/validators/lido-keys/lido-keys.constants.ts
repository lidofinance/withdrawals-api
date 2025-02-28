import { CHAINS } from '@lido-nestjs/constants';

const DEVNET_7 = '7032118028';

export const KEYS_API_ADDRESS = {
  [CHAINS.Mainnet]: 'https://keys-api.lido.fi/v1/keys?used=true',
  [CHAINS.Goerli]: 'https://keys-api.testnet.fi/v1/keys?used=true',
  [CHAINS.Holesky]: 'https://keys-api-holesky.testnet.fi/v1/keys?used=true',
  [DEVNET_7]: 'http://hr6vb81d1ndsx-pectra-devnet-7-keys-api.valset-01.testnet.fi/v1/keys?used=true',
};
