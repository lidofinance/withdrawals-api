import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService, ENV_KEYS, EnvironmentVariables } from 'common/config';
import { PrometheusService } from 'common/prometheus';
import { ConsensusProviderService } from 'common/consensus-provider';
import { ExecutionProviderService } from 'common/execution-provider';
import { APP_NAME, APP_VERSION } from './app.constants';
import { commonPatterns, satanizer } from '@lidofinance/satanizer';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly configService: ConfigService,
    protected readonly prometheusService: PrometheusService,
    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly executionProviderService: ExecutionProviderService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.validateNetwork();
    await this.prometheusBuildInfoMetrics();
    this.prometheusEnvsInfoMetrics();
  }

  /**
   * Validates the CL and EL chains match
   */
  protected async validateNetwork(): Promise<void> {
    const chainId = this.configService.get('CHAIN_ID');
    const depositContract = await this.consensusProviderService.getDepositContract();
    const elChainId = await this.executionProviderService.getChainId();
    const clChainId = Number(depositContract.data?.chain_id);

    if (chainId !== elChainId || elChainId !== clChainId) {
      throw new Error('Chain ids do not match');
    }
  }

  protected async prometheusBuildInfoMetrics() {
    const network = await this.executionProviderService.getNetworkName();
    const env = this.configService.get('NODE_ENV');
    const version = APP_VERSION;
    const name = APP_NAME;

    this.prometheusService.buildInfo.labels({ env, network, name, version }).inc();
    this.logger.log('Init app', { env, network, name, version });
  }

  protected prometheusEnvsInfoMetrics() {
    const secrets = this.configService.secrets;
    const mask = satanizer([...commonPatterns, ...secrets]);

    const allConfigEnvs = {};
    ENV_KEYS.forEach((key: keyof EnvironmentVariables) => {
      allConfigEnvs[key] = mask(this.configService.get(key));
    });

    this.prometheusService.envsInfo.labels(allConfigEnvs).inc();
    this.logger.log('Init app dumping envs', allConfigEnvs);
  }
}
