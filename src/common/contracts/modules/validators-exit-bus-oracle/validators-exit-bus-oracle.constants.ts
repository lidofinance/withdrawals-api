import { CHAINS } from '@lido-nestjs/constants';

export const VALIDATORS_EXIT_BUS_ORACLE_TOKEN = Symbol(
  'validatorsExitBusOracleHashConsensus',
);

export const VALIDATORS_EXIT_BUS_ORACLE_CONTRACT_ADDRESSES = {
  [CHAINS.Mainnet]: '0x0De4Ea0184c2ad0BacA7183356Aea5B8d5Bf5c6e',
  [CHAINS.Holesky]: '0xffDDF7025410412deaa05E3E1cE68FE53208afcb',
  [CHAINS.Sepolia]: '0x7637d44c9f2e9cA584a8B5D2EA493012A5cdaEB6 ',
};
