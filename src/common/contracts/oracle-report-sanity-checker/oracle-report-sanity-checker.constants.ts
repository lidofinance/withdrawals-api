import { CHAINS } from '@lido-nestjs/constants';

export const ORACLE_REPORT_SANITY_CHECKER_TOKEN = Symbol(
  'oracleReportSanityChecker',
);

export const ORACLE_REPORT_SANITY_CHECKER_ADDRESSES = {
  [CHAINS.Mainnet]: '0x9305c1Dbfe22c12c66339184C0025d7006f0f1cC',
  [CHAINS.Goerli]: '0xbf74600040F91D3560d5757280727FB00c64Fd2E',
  // [CHAINS.Kiln]: '0x3E50180cf438e185ec52Ade55855718584541476',
  // [CHAINS.Zhejiang]: '0xDe82ADEd58dA35add75Ea4676239Ca169c8dCD15',
};
