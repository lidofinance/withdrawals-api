import { CHAINS } from '@lido-nestjs/constants';

export const BURNER_TOKEN = Symbol('burner');

export const BURNER_ADDRESSES = {
  [CHAINS.Mainnet]: '0xD15a672319Cf0352560eE76d9e89eAB0889046D3',
  [CHAINS.Goerli]: '0x20c61C07C2E2FAb04BF5b4E12ce45a459a18f3B1',
};
