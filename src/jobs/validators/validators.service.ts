import { CronJob } from 'cron';
import { BigNumber } from 'ethers';
import { Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { ConsensusProviderService } from 'common/consensus-provider';
import { GenesisTimeService } from 'common/genesis-time';
import { OneAtTime } from '@lido-nestjs/decorators';
import { ValidatorsStorageService } from 'storage';
import { FAR_FUTURE_EPOCH, MAX_SEED_LOOKAHEAD } from './validators.constants';

export class ValidatorsService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
    protected readonly validatorsStorageService: ValidatorsStorageService,
    protected readonly genesisTimeService: GenesisTimeService,
  ) {}

  /**
   * Initializes the job
   */
  public async initialize(): Promise<void> {
    await this.updateValidators();

    const cronTime = this.configService.get('JOB_INTERVAL_VALIDATORS');
    const job = new CronJob(cronTime, () => this.updateValidators());
    job.start();

    this.logger.log('Service initialized', { service: 'validators', cronTime });
  }

  @OneAtTime()
  protected async updateValidators(): Promise<void> {
    await this.jobService.wrapJob({ name: 'update validators' }, async () => {
      const { data } = await this.consensusProviderService.getStateValidators({ stateId: 'head' });

      const totalValidators = data.length;
      const currentEpoch = this.genesisTimeService.getCurrentEpoch();
      const validatorsExitEpochs = data.map((v) => v.validator.exit_epoch);
      validatorsExitEpochs.push(`${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`);

      const latestEpoch = validatorsExitEpochs.reduce((acc, v) => {
        if (v !== FAR_FUTURE_EPOCH.toString()) {
          if (BigNumber.from(v).gt(BigNumber.from(acc))) {
            return v;
          }
        }
        return acc;
      }, '0');

      this.validatorsStorageService.setTotal(totalValidators);
      this.validatorsStorageService.setMaxExitEpoch(latestEpoch);
      this.validatorsStorageService.setLastUpdate(Math.floor(Date.now() / 1000));
    });
  }
}
