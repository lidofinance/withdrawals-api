import { CHAINS } from '@lido-nestjs/constants';

export const ACCOUNTING_ORACLE_TOKEN = Symbol(
  'hashConsensus',
);

export const ACCOUNTING_ORACLE_ADDRESSES = {
  [CHAINS.Mainnet]: '0x852deD011285fe67063a08005c71a85690503Cee',
  [CHAINS.Goerli]: '0x76f358A842defa0E179a8970767CFf668Fc134d6',
};
