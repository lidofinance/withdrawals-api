import { ConfigService as ConfigServiceSource } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';
import {
  AccountingOracleHashConsensusModule,
  LidoContractModule,
  LidoLocatorContractModule,
  OracleReportSanityCheckerModule,
  ValidatorsExitBusOracleHashConsensusModule,
  WithdrawalQueueContractModule,
} from '@lido-nestjs/contracts';

export class ConfigService extends ConfigServiceSource<EnvironmentVariables> {
  /**
   * List of env variables that should be hidden
   */
  public get secrets(): string[] {
    const clAPIUrls = this.get('CL_API_URLS');
    const elAPIUrls = this.get('EL_RPC_URLS');
    const keys = [...clAPIUrls, ...elAPIUrls].map((url) => {
      const urlArr = url.split('/');
      return urlArr[urlArr.length - 1];
    });
    return [this.get('SENTRY_DSN') ?? '', ...keys].filter((v) => v).map((v) => String(v));
  }

  public get<T extends keyof EnvironmentVariables>(key: T): EnvironmentVariables[T] {
    return super.get(key, { infer: true }) as EnvironmentVariables[T];
  }

  public getCustomConfigContractsAddressMap() {
    return new Map<symbol, string>([
      [WithdrawalQueueContractModule.contractToken, this.get('WITHDRAWAL_QUEUE_CONTRACT_DEVNET_ADDRESS')],
      [LidoContractModule.contractToken, this.get('LIDO_CONTRACT_DEVNET_ADDRESS')],
      [OracleReportSanityCheckerModule.contractToken, this.get('ORACLE_REPORT_SANITY_CHECKER_DEVNET_ADDRESS')],
      [AccountingOracleHashConsensusModule.contractToken, this.get('ACCOUNTING_ORACLE_HASH_CONSENSUS_DEVNET_ADDRESS')],
      [
        ValidatorsExitBusOracleHashConsensusModule.contractToken,
        this.get('VALIDATORS_EXIT_BUS_ORACLE_HASH_CONSENSUS_DEVNET_ADDRESS'),
      ],
      [LidoLocatorContractModule.contractToken, this.get('LIDO_LOCATOR_CONTRACT_DEVNET_ADDRESS')],
    ]);
  }
}
