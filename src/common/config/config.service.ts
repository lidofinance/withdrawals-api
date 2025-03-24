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
import { devnetConfigs } from './devnets/configs';
import { DevnetName } from './devnets/devnet-config.interface';

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
    if (!this.get('DEVNET_NAME')) {
      return null;
    }

    return new Map<symbol, string>([
      [WithdrawalQueueContractModule.contractToken, devnetConfigs[DevnetName.Devnet8].contracts['WithdrawalQueue']],

      [LidoContractModule.contractToken, devnetConfigs[DevnetName.Devnet8].contracts['Lido']],
      [
        OracleReportSanityCheckerModule.contractToken,
        devnetConfigs[DevnetName.Devnet8].contracts['OracleReportSanityChecker'],
      ],
      [
        AccountingOracleHashConsensusModule.contractToken,
        devnetConfigs[DevnetName.Devnet8].contracts['AccountingOracleHashConsensus'],
      ],
      [
        ValidatorsExitBusOracleHashConsensusModule.contractToken,
        devnetConfigs[DevnetName.Devnet8].contracts['ValidatorsExitBusOracleHashConsensus'],
      ],
      [LidoLocatorContractModule.contractToken, devnetConfigs[DevnetName.Devnet8].contracts['LidoLocator']],
    ]);
  }
}
