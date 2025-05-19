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
} from '@lido-nestjs/contracts';
import { ContractConfigStorageService } from 'storage';

@Injectable()
export class ContractConfigService {
  static SERVICE_LOG_NAME = 'contract config';

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(ORACLE_REPORT_SANITY_CHECKER_TOKEN) protected readonly oracleReportSanityChecker: OracleReportSanityChecker,
    @Inject(ACCOUNTING_ORACLE_HASH_CONSENSUS_TOKEN) protected readonly accountingOracleHashConsensus: HashConsensus,
    @Inject(VALIDATORS_EXIT_BUS_ORACLE_HASH_CONSENSUS_TOKEN) protected readonly veboHashConsensus: HashConsensus,

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

  @OneAtTime()
  protected async updateContractConfig(): Promise<void> {
    await this.jobService.wrapJob(
      { name: 'contract config', service: ContractConfigService.SERVICE_LOG_NAME },
      async () => {
        this.logger.log('Start update contract config', { service: ContractConfigService.SERVICE_LOG_NAME });

        const [limits, frameConfig, veboFrameConfig] = await Promise.all([
          this.oracleReportSanityChecker.getOracleReportLimits(),
          this.accountingOracleHashConsensus.getFrameConfig(),
          this.veboHashConsensus.getFrameConfig(),
        ]);

        this.contractConfig.setRequestTimestampMargin(limits.requestTimestampMargin.toNumber() * 1000);
        this.contractConfig.setMaxValidatorExitRequestsPerReport(limits.maxValidatorExitRequestsPerReport.toNumber());
        this.contractConfig.setInitialEpoch(frameConfig.initialEpoch.toNumber());
        this.contractConfig.setEpochsPerFrameVEBO(veboFrameConfig.epochsPerFrame.toNumber());
        this.contractConfig.setEpochsPerFrame(frameConfig.epochsPerFrame.toNumber());
        this.contractConfig.setLastUpdate(Math.floor(Date.now() / 1000));

        this.logger.log('End update contract config', {
          service: ContractConfigService.SERVICE_LOG_NAME,
          requestTimestampMargin: limits.requestTimestampMargin.toNumber(),
          maxValidatorExitRequestsPerReport: limits.maxValidatorExitRequestsPerReport.toNumber(),
          initialEpoch: frameConfig.initialEpoch.toNumber(),
          epochsPerFrameVEBO: frameConfig.epochsPerFrame.toNumber(),
          epochsPerFrame: frameConfig.epochsPerFrame.toNumber(),
        });
      },
    );
  }
}
