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
    await this.updateContractConfig();

    const cronTime = this.configService.get('JOB_INTERVAL_CONTRACT_CONFIG');
    const job = new CronJob(cronTime, () => this.updateContractConfig());
    job.start();

    this.logger.log('Service initialized', { service: 'contract config', cronTime });
  }

  @OneAtTime()
  protected async updateContractConfig(): Promise<void> {
    await this.jobService.wrapJob({ name: 'contract config' }, async () => {
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
    });
  }
}
