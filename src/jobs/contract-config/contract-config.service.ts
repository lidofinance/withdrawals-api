import { CronJob } from 'cron';
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { OneAtTime } from '@lido-nestjs/decorators';
import {
  OracleReportSanityChecker,
  ORACLE_REPORT_SANITY_CHECKER_TOKEN,
  HashConsensus,
  ACCOUNTING_ORACLE_HASH_CONSENSUS_TOKEN,
  VALIDATORS_EXIT_BUS_ORACLE_HASH_CONSENSUS_TOKEN,
  LIDO_LOCATOR_CONTRACT_TOKEN,
  LidoLocator,
} from '@lido-nestjs/contracts';
import { ContractConfigStorageService } from 'storage';

@Injectable()
export class ContractConfigService {
  static SERVICE_LOG_NAME = 'contract config';
  protected isSubscribedToFrameConfigUpdates = false;

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(ORACLE_REPORT_SANITY_CHECKER_TOKEN) protected readonly oracleReportSanityChecker: OracleReportSanityChecker,
    @Inject(ACCOUNTING_ORACLE_HASH_CONSENSUS_TOKEN) protected readonly accountingOracleHashConsensus: HashConsensus,
    @Inject(VALIDATORS_EXIT_BUS_ORACLE_HASH_CONSENSUS_TOKEN) protected readonly veboHashConsensus: HashConsensus,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,

    protected readonly contractConfig: ContractConfigStorageService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    if (this.configService.get('IS_SERVICE_UNAVAILABLE')) {
      return;
    }

    this.subscribeToFrameConfigUpdates();

    try {
      await this.updateContractConfig();
    } catch (error) {
      this.logger.error(error);
    }

    const cronTime = this.configService.get('JOB_INTERVAL_CONTRACT_CONFIG');
    const job = new CronJob(cronTime, () => this.updateContractConfig());
    job.start();

    this.logger.log('Service initialized', { service: ContractConfigService.SERVICE_LOG_NAME, cronTime });
  }

  protected subscribeToFrameConfigUpdates(): void {
    if (this.isSubscribedToFrameConfigUpdates) {
      return;
    }

    this.isSubscribedToFrameConfigUpdates = true;

    const accountingFrameConfigSet = this.accountingOracleHashConsensus.filters.FrameConfigSet();
    const veboFrameConfigSet = this.veboHashConsensus.filters.FrameConfigSet();

    this.accountingOracleHashConsensus.on(accountingFrameConfigSet, () => {
      this.handleFrameConfigUpdateEvent('accounting');
    });

    this.veboHashConsensus.on(veboFrameConfigSet, () => {
      this.handleFrameConfigUpdateEvent('vebo');
    });
  }

  protected async handleFrameConfigUpdateEvent(source: 'accounting' | 'vebo'): Promise<void> {
    this.logger.log('FrameConfigSet event triggered', {
      service: ContractConfigService.SERVICE_LOG_NAME,
      source,
    });

    try {
      await this.updateContractConfig();
    } catch (error) {
      this.logger.error(error, {
        service: ContractConfigService.SERVICE_LOG_NAME,
        source,
      });
    }
  }

  @OneAtTime()
  protected async updateContractConfig(): Promise<void> {
    await this.jobService.wrapJob(
      { name: 'contract config', service: ContractConfigService.SERVICE_LOG_NAME },
      async () => {
        this.logger.log('Start update contract config', { service: ContractConfigService.SERVICE_LOG_NAME });

        const [
          limits,
          frameConfig,
          veboFrameConfig,
          accountingOracleAddress,
          withdrawalVaultAddress,
          elRewardsVaultAddress,
        ] = await Promise.all([
          this.oracleReportSanityChecker.getOracleReportLimits(),
          this.accountingOracleHashConsensus.getFrameConfig(),
          this.veboHashConsensus.getFrameConfig(),
          this.lidoLocator.accountingOracle(),
          this.lidoLocator.withdrawalVault(),
          this.lidoLocator.elRewardsVault(),
        ]);

        this.contractConfig.setRequestTimestampMargin(limits.requestTimestampMargin.toNumber() * 1000);
        this.contractConfig.setMaxValidatorExitRequestsPerReport(limits.maxValidatorExitRequestsPerReport.toNumber());
        this.contractConfig.setInitialEpoch(frameConfig.initialEpoch.toNumber());
        this.contractConfig.setEpochsPerFrameVEBO(veboFrameConfig.epochsPerFrame.toNumber());
        this.contractConfig.setEpochsPerFrame(frameConfig.epochsPerFrame.toNumber());
        this.contractConfig.setAccountingOracleAddress(accountingOracleAddress);
        this.contractConfig.setWithdrawalVaultAddress(withdrawalVaultAddress);
        this.contractConfig.setElRewardsVaultAddress(elRewardsVaultAddress);
        this.contractConfig.setLastUpdate(Math.floor(Date.now() / 1000));

        this.logger.log('End update contract config', {
          service: ContractConfigService.SERVICE_LOG_NAME,
          requestTimestampMargin: limits.requestTimestampMargin.toNumber(),
          maxValidatorExitRequestsPerReport: limits.maxValidatorExitRequestsPerReport.toNumber(),
          initialEpoch: frameConfig.initialEpoch.toNumber(),
          epochsPerFrameVEBO: veboFrameConfig.epochsPerFrame.toNumber(),
          epochsPerFrame: frameConfig.epochsPerFrame.toNumber(),
          accountingOracleAddress,
          withdrawalVaultAddress,
          elRewardsVaultAddress,
        });
      },
    );
  }
}
