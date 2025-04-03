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
import { findNetworkConfig } from './networks/utils/find-network-config';
import { KEYS_API_PATHS } from '../../jobs/validators/lido-keys/lido-keys.constants';
import { Injectable } from '@nestjs/common';
import { NetworkConfig } from './networks';

@Injectable()
export class ConfigService extends ConfigServiceSource<EnvironmentVariables> {
  networkConfig: NetworkConfig;
  constructor(internalConfig?: Partial<EnvironmentVariables>) {
    super(internalConfig);

    const name = this.get('CUSTOM_NETWORK_FILE_NAME');
    if (name) {
      this.networkConfig = findNetworkConfig(name);
    }
  }
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
    const name = this.get('CUSTOM_NETWORK_FILE_NAME');

    if (!name) {
      return null;
    }

    if (!this.networkConfig) {
      return null;
    }

    const contracts = this.networkConfig.contracts;

    return new Map<symbol, string>([
      [WithdrawalQueueContractModule.contractToken, contracts.withdrawalQueue],
      [LidoContractModule.contractToken, contracts.lido],
      [OracleReportSanityCheckerModule.contractToken, contracts.oracleReportSanityChecker],
      [AccountingOracleHashConsensusModule.contractToken, contracts.accountingOracleHashConsensus],
      [ValidatorsExitBusOracleHashConsensusModule.contractToken, contracts.validatorsExitBusOracleHashConsensus],
      [LidoLocatorContractModule.contractToken, contracts.lidoLocator],
    ]);
  }

  public async getKeysApiBasePath(): Promise<string> {
    const name = this.get('CUSTOM_NETWORK_FILE_NAME');

    if (name) {
      const keysApiBasePath = this.networkConfig.apis.keysApiBasePath;

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
