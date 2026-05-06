import { CronJob } from 'cron';
import { BigNumber } from '@ethersproject/bignumber';
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { OneAtTime } from '@lido-nestjs/decorators';
import {
  HashConsensus,
  ACCOUNTING_ORACLE_HASH_CONSENSUS_TOKEN,
  VALIDATORS_EXIT_BUS_ORACLE_HASH_CONSENSUS_TOKEN,
  LIDO_LOCATOR_CONTRACT_TOKEN,
  LidoLocator,
} from '@lido-nestjs/contracts';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { ContractConfigStorageService } from 'storage';
import { ValidatorsService } from '../validators';
import { LidoExtensionReader } from './lido-extension-reader';
import { OracleLimitsReader } from './oracle-limits-reader';

@Injectable()
export class ContractConfigService {
  static SERVICE_LOG_NAME = 'contract config';
  protected isSubscribedToFrameConfigUpdates = false;

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(ACCOUNTING_ORACLE_HASH_CONSENSUS_TOKEN) protected readonly accountingOracleHashConsensus: HashConsensus,
    @Inject(VALIDATORS_EXIT_BUS_ORACLE_HASH_CONSENSUS_TOKEN) protected readonly veboHashConsensus: HashConsensus,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,

    protected readonly oracleLimitsReader: OracleLimitsReader,
    protected readonly lidoExtensionReader: LidoExtensionReader,
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly validatorsService: ValidatorsService,
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

        // Gate the target read on the previous-tick storage flag: don't call on pre-SR-3
        // contracts (would emit warn-spam from the defensive try/catch in the reader). One-tick
        // lag after SR-3 detection is acceptable — target stays at default 0 for that tick,
        // projection netting becomes a no-op (same behavior as pre-SR-3). Next tick fetches
        // the real value.
        const wasSrv3KnownLastTick = this.contractConfig.getLidoSupportsDepositsReserve();
        const blockNumber = await this.provider.getBlockNumber();

        const [
          unifiedLimits,
          lidoSupportsDepositsReserve,
          depositsReserveTarget,
          frameConfig,
          veboFrameConfig,
          accountingOracleAddress,
          withdrawalVaultAddress,
          elRewardsVaultAddress,
        ] = await Promise.all([
          this.oracleLimitsReader.read(),
          this.lidoExtensionReader.probe(),
          wasSrv3KnownLastTick
            ? this.lidoExtensionReader.getDepositsReserveTargetAt(blockNumber)
            : Promise.resolve(BigNumber.from(0)),
          this.accountingOracleHashConsensus.getFrameConfig(),
          this.veboHashConsensus.getFrameConfig(),
          this.lidoLocator.accountingOracle(),
          this.lidoLocator.withdrawalVault(),
          this.lidoLocator.elRewardsVault(),
        ]);

        this.contractConfig.setRequestTimestampMargin(unifiedLimits.requestTimestampMargin.toNumber() * 1000);
        this.contractConfig.setMaxBalanceExitRequestedPerReportInEth(
          unifiedLimits.maxBalanceExitRequestedPerReportInEth,
        );
        this.contractConfig.setLidoSupportsDepositsReserve(lidoSupportsDepositsReserve);
        this.contractConfig.setDepositsReserveTarget(depositsReserveTarget);
        this.contractConfig.setInitialEpoch(frameConfig.initialEpoch.toNumber());
        this.contractConfig.setEpochsPerFrameVEBO(veboFrameConfig.epochsPerFrame.toNumber());
        this.contractConfig.setEpochsPerFrame(frameConfig.epochsPerFrame.toNumber());
        this.contractConfig.setAccountingOracleAddress(accountingOracleAddress);
        this.contractConfig.setWithdrawalVaultAddress(withdrawalVaultAddress);
        this.contractConfig.setElRewardsVaultAddress(elRewardsVaultAddress);
        this.contractConfig.setLastUpdate(Math.floor(Date.now() / 1000));

        this.validatorsService.rescheduleCronJobs(
          veboFrameConfig.initialEpoch.toNumber(),
          veboFrameConfig.epochsPerFrame.toNumber(),
        );

        this.logger.log('End update contract config', {
          service: ContractConfigService.SERVICE_LOG_NAME,
          requestTimestampMargin: unifiedLimits.requestTimestampMargin.toNumber(),
          maxBalanceExitRequestedPerReportInEth: unifiedLimits.maxBalanceExitRequestedPerReportInEth.toNumber(),
          lidoSupportsDepositsReserve,
          depositsReserveTarget: depositsReserveTarget.toString(),
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
