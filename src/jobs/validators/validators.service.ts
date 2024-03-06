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
import { processValidatorsStream } from 'jobs/validators/utils/validators-stream';
import { unblock } from '../../common/utils/unblock';
import { LidoKeysService } from './lido-keys';
import { ResponseValidatorsData, Validator } from './validators.types';
import { parseGweiToWei } from '../../common/utils/parse-gwei-to-big-number';

export class ValidatorsService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly configService: ConfigService,
    protected readonly jobService: JobService,
    protected readonly validatorsStorageService: ValidatorsStorageService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly lidoKeys: LidoKeysService,
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
      });
      const data: ResponseValidatorsData = await processValidatorsStream(stream);
      const currentEpoch = this.genesisTimeService.getCurrentEpoch();

      let totalValidators = 0;
      let latestEpoch = `${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`;

      for (const item of data) {
        if (['active_ongoing', 'active_exiting', 'active_slashed'].includes(item.status)) {
          totalValidators++;
        }

        if (item.validator.exit_epoch !== FAR_FUTURE_EPOCH.toString()) {
          if (BigNumber.from(item.validator.exit_epoch).gt(BigNumber.from(latestEpoch))) {
            latestEpoch = item.validator.exit_epoch;
          }
        }

        await unblock();
      }
      this.validatorsStorageService.setTotal(totalValidators);
      this.validatorsStorageService.setMaxExitEpoch(latestEpoch);
      this.validatorsStorageService.setLastUpdate(Math.floor(Date.now() / 1000));

      await this.setLidoValidatorsWithdrawableBalances(data);
    });
  }

  protected async setLidoValidatorsWithdrawableBalances(validators: Validator[]) {
    const keysData = await this.lidoKeys.fetchLidoKeysData();
    const lidoValidators = await this.lidoKeys.getLidoValidatorsByKeys(keysData.data, validators);

    const frameBalances = {};

    for (const item of lidoValidators) {
      if (item.validator.withdrawable_epoch !== FAR_FUTURE_EPOCH.toString() && BigNumber.from(item.balance).gt(0)) {
        const frame = this.genesisTimeService.getFrameOfEpoch(Number(item.validator.withdrawable_epoch));
        const prevBalance = frameBalances[frame];
        const balance = parseGweiToWei(item.balance);
        frameBalances[frame] = prevBalance ? prevBalance.add(balance) : BigNumber.from(balance);
      }

      await unblock();
    }

    this.validatorsStorageService.setFrameBalances(frameBalances);
  }
}
