import { BadRequestException, Injectable } from '@nestjs/common';
import { ValidatorsStorageService, QueueInfoStorageService } from 'storage';
import { BigNumber } from '@ethersproject/bignumber';

import { parseEther, formatEther } from '@ethersproject/units';
import { ConfigService } from 'common/config';
import {
  EPOCH_PER_FRAME,
  GAP_AFTER_REPORT,
  GenesisTimeService,
  REQUEST_TIMESTAMP_MARGIN,
  SECONDS_PER_SLOT,
  SLOTS_PER_EPOCH,
} from 'common/genesis-time';

import {
  MIN_PER_EPOCH_CHURN_LIMIT,
  CHURN_LIMIT_QUOTIENT,
  MAX_EFFECTIVE_BALANCE,
  MAX_WITHDRAWALS_PER_PAYLOAD,
} from './request-time.constants';
import { maxMinNumberValidation } from './request-time.utils';
import { RequestTimeDto, RequestTimeOptionsDto } from './dto';

@Injectable()
export class RequestTimeService {
  constructor(
    protected readonly validators: ValidatorsStorageService,
    protected readonly queueInfo: QueueInfoStorageService,
    protected readonly configService: ConfigService,
    protected readonly genesisTimeService: GenesisTimeService,
  ) {}

  async getRequestTime(params: RequestTimeOptionsDto): Promise<RequestTimeDto | null> {
    this.validate(params);

    const validatorsLastUpdate = this.validators.getLastUpdate();
    if (!validatorsLastUpdate) return null;

    const unfinalizedETH = this.queueInfo.getStETH();
    if (!unfinalizedETH) return null;

    const additionalStETH = parseEther(params.amount || '0');
    const queueStETH = unfinalizedETH.add(additionalStETH);

    const stethLastUpdate = this.queueInfo.getLastUpdate();
    const days = this.calculateRequestTime(queueStETH);

    const mss = this.calculateWithdrawalTime(additionalStETH, queueStETH);
    console.log(mss);
    const requestsCount = this.queueInfo.getRequests();

    return {
      days,
      // mss,
      stethLastUpdate,
      validatorsLastUpdate,
      steth: unfinalizedETH.toString(),
      requests: requestsCount.toNumber(),
    };
  }

  calculateWithdrawalTime(withdrawalEth: BigNumber, unfinalizedETH: BigNumber) {
    const depositableEther = this.queueInfo.getDepositableEther();
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
    let result: null | number = null; // mins

    console.log(`depositableEther=${depositableEther.toString()}\nwithdrawalEth=${withdrawalEth.toString()}`);
    // if enough depositable ether
    if (depositableEther.gt(withdrawalEth)) {
      console.log(`case depositableEther gt withdrawalEth`);
      result = this.timeToWithdrawalFrame(currentFrame + 1);
    }

    // postpone withdrawal request which is too close to report
    if (result !== null && result < REQUEST_TIMESTAMP_MARGIN) {
      console.log('case result < REQUEST_TIMESTAMP_MARGIN');
      result = this.timeToWithdrawalFrame(currentFrame + 2);
    }

    // if none of up cases worked use long period calculation
    if (result === null) {
      console.log('case calculateFrameExitValidatorsCase');
      const nextFrame = this.calculateFrameExitValidatorsCase(unfinalizedETH);
      result = this.timeToWithdrawalFrame(nextFrame);
    }

    return result + GAP_AFTER_REPORT;
  }

  timeToWithdrawalFrame(frame: number) {
    const genesisTime = this.genesisTimeService.getGenesisTime();
    const epochOfNextReport = this.genesisTimeService.getInitialEpoch() + frame * EPOCH_PER_FRAME;
    const timeToNextReport = epochOfNextReport * SECONDS_PER_SLOT * SLOTS_PER_EPOCH;

    console.log('frame time start', genesisTime + timeToNextReport);
    return Math.round(genesisTime + timeToNextReport - Date.now() / 1000) * 1000; // in ms
  }

  calculateFrameExitValidatorsCase(unfinalizedETH: BigNumber): number {
    // latest epoch of most late to exit validators
    const latestEpoch = this.validators.getMaxExitEpoch();
    const totalValidators = this.validators.getTotal();

    // max number limit of create or remove validators per epoch
    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);

    // number of epochs to finalize all eth
    const lidoQueueInEpoch = unfinalizedETH.div(MAX_EFFECTIVE_BALANCE.mul(Math.floor(churnLimit)));

    // time to find validators for removing (why calculate like this?)
    const sweepingMean = BigNumber.from(totalValidators)
      .div(BigNumber.from(MAX_WITHDRAWALS_PER_PAYLOAD).mul(SLOTS_PER_EPOCH))
      .div(2);
    const potentialExitEpoch = BigNumber.from(latestEpoch).add(lidoQueueInEpoch).add(sweepingMean);

    // should I rework all this to big int?
    return this.genesisTimeService.getFrameOfEpoch(potentialExitEpoch.toNumber()) + 1;
  }

  calculateLastRewards() {
    const LIDO_ELREWARDSRECEIVED_EVENT = 'event ELRewardsReceived(uint256 amount)';
  }

  calculateRequestTime(unfinalizedETH: BigNumber): number {
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();
    const latestEpoch = this.validators.getMaxExitEpoch();
    const totalValidators = this.validators.getTotal();

    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);

    const lidoQueueInEpoch = unfinalizedETH.div(MAX_EFFECTIVE_BALANCE.mul(Math.floor(churnLimit)));
    const sweepingMean = BigNumber.from(totalValidators)
      .div(BigNumber.from(MAX_WITHDRAWALS_PER_PAYLOAD).mul(SLOTS_PER_EPOCH))
      .div(2);
    const potentialExitEpoch = BigNumber.from(latestEpoch).add(lidoQueueInEpoch).add(sweepingMean);

    const waitingTime = potentialExitEpoch
      .sub(currentEpoch)
      .mul(SECONDS_PER_SLOT)
      .mul(SLOTS_PER_EPOCH)
      .div(60 * 60 * 24);

    return Math.round(waitingTime.toNumber());
  }

  validate(params: RequestTimeOptionsDto) {
    if (!this.queueInfo.getMinStethAmount()) return;

    const minAmount = formatEther(this.queueInfo.getMinStethAmount());
    const isValidAmount = maxMinNumberValidation(params.amount, minAmount);
    const isNeedValidate = params.amount && Number(params.amount) !== 0;

    if (isNeedValidate && !isValidAmount.isValid) {
      throw new BadRequestException(isValidAmount.message);
    }
  }
}
