export enum DevnetName {
  Devnet8 = 'Devnet8',
}

export const requiredContracts = [
  'WithdrawalQueue',
  'Lido',
  'OracleReportSanityChecker',
  'AccountingOracleHashConsensus',
  'ValidatorsExitBusOracleHashConsensus',
  'LidoLocator',
] as const;

export interface DevnetConfig {
  name: DevnetName;
  contracts: Record<(typeof requiredContracts)[number], string>;
  keysApiBasePath: string;
}
