import { ConfigService as ConfigServiceSource } from '@nestjs/config';
import {
  AccountingOracleHashConsensusModule,
  LidoContractModule,
  LidoLocatorContractModule,
  OracleReportSanityCheckerModule,
  ValidatorsExitBusOracleHashConsensusModule,
  WithdrawalQueueContractModule,
} from '@lido-nestjs/contracts';
import { EnvironmentVariables } from './env.validation';
import { findDevnetConfig } from './utils/find-devnet-config';
import { KEYS_API_PATHS } from '../../jobs/validators/lido-keys/lido-keys.constants';

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

  public async getCustomConfigContractsAddressMap() {
    const name = this.get('DEVNET_NAME');

    if (!name) {
      return null;
    }

    const devnetConfig = await findDevnetConfig(name);

    return new Map<symbol, string>([
      [WithdrawalQueueContractModule.contractToken, devnetConfig['WithdrawalQueue']],

      [LidoContractModule.contractToken, devnetConfig['Lido']],
      [OracleReportSanityCheckerModule.contractToken, devnetConfig['OracleReportSanityChecker']],
      [AccountingOracleHashConsensusModule.contractToken, devnetConfig['AccountingOracleHashConsensus']],
      [ValidatorsExitBusOracleHashConsensusModule.contractToken, devnetConfig['ValidatorsExitBusOracleHashConsensus']],
      [LidoLocatorContractModule.contractToken, devnetConfig['LidoLocator']],
    ]);
  }

  public async getKeysApiBasePath(): Promise<string> {
    const name = this.get('DEVNET_NAME');

    if (name) {
      const devnetConfig = await findDevnetConfig(name);
      const keysApiBasePath = devnetConfig['KeysApiBasePath'];

      if (keysApiBasePath) {
        return keysApiBasePath;
      }
    }

    const envUrl = this.get('KEYS_API_BASE_PATH');

    if (envUrl) {
      return envUrl;
    }

    const chainId = this.get('CHAIN_ID');
    return KEYS_API_PATHS[chainId];
  }
}
