export interface NetworkConfig {
  contracts: {
    withdrawalQueue: string;
    lido: string;
    oracleReportSanityChecker: string;
    accountingOracleHashConsensus: string;
    validatorsExitBusOracleHashConsensus: string;
    lidoLocator: string;
  };
  apis: {
    keysApiBasePath: string;
  };
}
