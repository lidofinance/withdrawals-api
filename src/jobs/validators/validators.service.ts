import { CronJob } from 'cron';
import { Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { JobService } from 'common/job';
import { ConfigService } from 'common/config';
import { ConsensusProviderService } from 'common/consensus-provider';
import { GenesisTimeService } from 'common/genesis-time';
import { OneAtTime } from '@lido-nestjs/decorators';
import { ValidatorsStorageService } from 'storage';
import { FAR_FUTURE_EPOCH, MAX_SEED_LOOKAHEAD } from './validators.constants';
import { BigNumber } from '@ethersproject/bignumber';
import { ConsensusMethodResult } from '@lido-nestjs/consensus/dist/interfaces/consensus.interface';
import { processValidatorsStream } from 'jobs/validators/utils/validators-stream';

type ResponseValidatorsData = Awaited<ConsensusMethodResult<'getStateValidators'>>['data'];

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
      const stream = await this.consensusProviderService.getStateValidatorsStream({
        stateId: 'head',
        status: [
          'active_exiting',
          'exited_slashed',
          'exited_unslashed',
          'pending_initialized',
          'pending_queued',
          'withdrawal_done',
          'withdrawal_possible',
        ],
      });
      const data: ResponseValidatorsData = await processValidatorsStream(stream);

      const totalValidators = data.length;
      const currentEpoch = this.genesisTimeService.getCurrentEpoch();
      const validatorsExitEpochs = data.map((v) => v.validator.exit_epoch);
      validatorsExitEpochs.push(`${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`);

      // research logs
      this.logger.log(
        data.reduce((acc, item) => {
          const key = item.status.toString();
          acc[key] = acc[key] ? acc[key] + 1 : 1;
          return acc;
        }, {}),
        'validators info',
      );

      this.logger.log(
        data.reduce((acc, item) => {
          if (item.validator.exit_epoch === FAR_FUTURE_EPOCH.toString()) {
            const key = item.status.toString();
            acc[key] = acc[key] ? acc[key] + 1 : 1;
          }
          return acc;
        }, {}),
        'validators info',
      );

      const latestEpoch = validatorsExitEpochs.reduce((acc, v) => {
        if (v !== FAR_FUTURE_EPOCH.toString()) {
          if (BigNumber.from(v).gt(BigNumber.from(acc))) {
            return v;
          }
        }
        return acc;
      }, '0');

      this.logger.log(`latestEpoch = ${latestEpoch}`, 'validators info');
      this.logger.log(
        `currentEpoch + MAX_SEED_LOOKAHEAD + 1 = ${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`,
        'validators info',
      );

      this.validatorsStorageService.setTotal(totalValidators);
      this.validatorsStorageService.setMaxExitEpoch(latestEpoch);
      this.validatorsStorageService.setLastUpdate(Math.floor(Date.now() / 1000));
    });
  }
}
