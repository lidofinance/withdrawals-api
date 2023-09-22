import { CronJob } from 'cron';
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { OneAtTime } from '@lido-nestjs/decorators';
import { QueueInfoStorageService } from 'storage';
import { WithdrawalQueue, Lido, WITHDRAWAL_QUEUE_CONTRACT_TOKEN, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { HashConsensus, OracleReportSanityChecker } from '../../common/contracts/generated';
import { ORACLE_REPORT_SANITY_CHECKER_TOKEN } from 'common/contracts/oracle-report-sanity-checker/oracle-report-sanity-checker.constants';
import { HASH_CONSENSUS_TOKEN } from '../../common/contracts/hash-consensus/hash-consensus.constants';

@Injectable()
export class QueueInfoService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contractWithdrawal: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    @Inject(ORACLE_REPORT_SANITY_CHECKER_TOKEN)
    protected readonly contractOracleReportSanityChecker: OracleReportSanityChecker,
    @Inject(HASH_CONSENSUS_TOKEN)
    protected readonly hashConsensus: HashConsensus,
    protected readonly queueInfoStorageService: QueueInfoStorageService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    await this.updateQueueInfo();

    const cronTime = this.configService.get('JOB_INTERVAL_QUEUE_INFO');
    const job = new CronJob(cronTime, () => this.updateQueueInfo());
    job.start();

    this.logger.log('Service initialized', { service: 'queue info', cronTime });
  }

  @OneAtTime()
  protected async updateQueueInfo(): Promise<void> {
    await this.jobService.wrapJob({ name: 'update queue info' }, async () => {
      const [
        unfinalizedStETH,
        unfinalizedRequests,
        minStethAmount,
        maxStethAmount,
        depositableEther,
        limits,
        frameConfig,
        chainConfig,
      ] = await Promise.all([
        this.contractWithdrawal.unfinalizedStETH(),
        this.contractWithdrawal.unfinalizedRequestNumber(),
        this.contractWithdrawal.MIN_STETH_WITHDRAWAL_AMOUNT(),
        this.contractWithdrawal.MAX_STETH_WITHDRAWAL_AMOUNT(),
        this.contractLido.getDepositableEther(),
        this.contractOracleReportSanityChecker.getOracleReportLimits(),
        this.hashConsensus.getFrameConfig(),
        this.hashConsensus.getChainConfig(),
      ]);
      this.queueInfoStorageService.setStETH(unfinalizedStETH);
      this.queueInfoStorageService.setRequests(unfinalizedRequests);
      this.queueInfoStorageService.setLastUpdate(Math.floor(Date.now() / 1000));
      this.queueInfoStorageService.setMinStethAmount(minStethAmount);
      this.queueInfoStorageService.setMaxStethAmount(maxStethAmount);
      this.queueInfoStorageService.setDepositableEther(depositableEther);
      this.queueInfoStorageService.setRequestTimestampMargin(limits.requestTimestampMargin.toNumber() * 1000);
      this.queueInfoStorageService.setInitialEpoch(frameConfig.initialEpoch);
      this.queueInfoStorageService.setFrameConfig(frameConfig);
      this.queueInfoStorageService.setChainConfig(chainConfig);
    });
  }
}
