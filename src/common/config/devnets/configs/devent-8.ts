import { DevnetConfig, DevnetName } from '../devnet-config.interface';

export const Devnet8Config: DevnetConfig = {
  name: DevnetName.Devnet8,
  contracts: {
    WithdrawalQueue: '0x00...',
    Lido: '0x00...',
    OracleReportSanityChecker: '0x00...',
    AccountingOracleHashConsensus: '0x00...',
    ValidatorsExitBusOracleHashConsensus: '0x00...',
    LidoLocator: '0x00...',
  },
  keysApiBasePath: '',
};
