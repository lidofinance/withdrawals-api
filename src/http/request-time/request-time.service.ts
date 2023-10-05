import { BadRequestException, Inject, Injectable, LoggerService } from '@nestjs/common';
import {
  ValidatorsStorageService,
  QueueInfoStorageService,
  RewardsStorageService,
  ContractConfigStorageService,
} from 'storage';
import { BigNumber } from '@ethersproject/bignumber';

import { parseEther, formatEther } from '@ethersproject/units';
import { ConfigService } from 'common/config';
import { GenesisTimeService, EPOCH_PER_FRAME, SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';

import {
  MIN_PER_EPOCH_CHURN_LIMIT,
  CHURN_LIMIT_QUOTIENT,
  MAX_EFFECTIVE_BALANCE,
  MAX_WITHDRAWALS_PER_PAYLOAD,
  GAP_AFTER_REPORT,
} from './request-time.constants';
import { maxMinNumberValidation } from './request-time.utils';
import { RequestTimeDto, RequestTimeOptionsDto } from './dto';
import { RequestTimeV2Dto } from './dto/request-time-v2.dto';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { RequestTimeByRequestIdDto } from './dto/request-time-by-request-id.dto';

@Injectable()
export class RequestTimeService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly validators: ValidatorsStorageService,
    protected readonly queueInfo: QueueInfoStorageService,
    protected readonly configService: ConfigService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly rewardsStorage: RewardsStorageService,
    protected readonly contractConfig: ContractConfigStorageService,
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

    const requestsCount = this.queueInfo.getUnfinalizedRequests();

    return {
      days,
      stethLastUpdate,
      validatorsLastUpdate,
      steth: unfinalizedETH.toString(),
      requests: requestsCount.toNumber(),
    };
  }
  async getRequestTimeV2(params: RequestTimeOptionsDto): Promise<RequestTimeV2Dto | null> {
    this.validate(params);

    const validatorsLastUpdate = this.validators.getLastUpdate();
    if (!validatorsLastUpdate) return null;

    const unfinalizedETH = this.queueInfo.getStETH();
    if (!unfinalizedETH) return null;

    const additionalStETH = parseEther(params.amount || '0');
    const queueStETH = unfinalizedETH.add(additionalStETH);

    const stethLastUpdate = this.queueInfo.getLastUpdate();

    const [toTimeWithdrawal, toTimeWithdrawalVEBO] = await this.calculateWithdrawalTimeV2(additionalStETH, queueStETH);

    const requestsCount = this.queueInfo.getUnfinalizedRequests();

    return {
      ms: toTimeWithdrawal,
      withdrawalAt: new Date(Date.now() + toTimeWithdrawal).toISOString(),
      stethLastUpdate,
      validatorsLastUpdate,
      steth: unfinalizedETH.toString(),
      requests: requestsCount.toNumber(),
      withVEBO: {
        ms: toTimeWithdrawalVEBO,
        withdrawalAt: new Date(Date.now() + toTimeWithdrawalVEBO).toISOString(),
      },
    };
  }

  async getTimeByRequestId(requestId: string): Promise<RequestTimeByRequestIdDto | null> {
    const requests = this.queueInfo.getRequests();
    if (!requests.length) return null;

    const request = requests.find((wr) => wr.id.eq(BigNumber.from(requestId)));
    if (!request) {
      // throw 404
      return null;
    }

    const validatorsLastUpdate = this.validators.getLastUpdate();
    if (!validatorsLastUpdate) return null;

    const unfinalizedETH = this.calculateUnfinalizedEthForRequestId(request.id);
    if (!unfinalizedETH) return null;

    const additionalStETH = request.amountOfStETH;
    const queueStETH = unfinalizedETH.add(additionalStETH);

    const [toTimeWithdrawal, toTimeWithdrawalVEBO] = await this.calculateWithdrawalTimeV2(additionalStETH, queueStETH);

    return {
      requestId: request.id.toString(),
      ms: toTimeWithdrawal,
      withdrawalAt: new Date(Date.now() + toTimeWithdrawal).toISOString(),
      withVEBO: {
        ms: toTimeWithdrawalVEBO,
        withdrawalAt: new Date(Date.now() + toTimeWithdrawalVEBO).toISOString(),
      },
    };
  }

  calculateUnfinalizedEthForRequestId(requestId: BigNumber) {
    const requests = this.queueInfo.getRequests();
    if (!requests.length) return null;

    const request = requests.find((wr) => wr.id.eq(BigNumber.from(requestId)));
    if (!request) {
      // throw 404
      return null;
    }

    let unfinalizedETH = BigNumber.from(0);
    for (const r of requests) {
      unfinalizedETH = unfinalizedETH.add(r.amountOfStETH);

      if (r.id.eq(requestId)) {
        break;
      }
    }

    return unfinalizedETH;
  }

  async calculateWithdrawalTimeV2(withdrawalEth: BigNumber, unfinalizedETH: BigNumber) {
    const depositableEther = this.queueInfo.getDepositableEther();
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
    let result: null | number = null; // mins
    let result2: null | number = null; // mins

    this.logger.debug({ depositableEther: depositableEther.toString(), withdrawalEth: withdrawalEth.toString() });
    // enough depositable ether
    if (depositableEther.gt(withdrawalEth)) {
      this.logger.debug(`case depositableEther gt withdrawalEth`);
      result = this.timeToWithdrawalFrame(currentFrame + 1);
    }

    // postpone withdrawal request which is too close to report
    if (result !== null && result < this.contractConfig.getRequestTimestampMargin()) {
      this.logger.debug('case result < RequestTimestampMargin');
      result = this.timeToWithdrawalFrame(currentFrame + 2);
    }

    // if none of up cases worked use long period calculation
    if (result === null) {
      this.logger.debug('case calculateFrameExitValidatorsCase');
      const nextFrame = await this.calculateFrameExitValidatorsCase(unfinalizedETH);
      const nextFrameVEBO = await this.calculateFrameExitValidatorsCaseWithVEBO(unfinalizedETH);
      result = this.timeToWithdrawalFrame(nextFrame);
      result2 = this.timeToWithdrawalFrame(nextFrameVEBO);
    }

    return [result + GAP_AFTER_REPORT, result2 ? result2 + GAP_AFTER_REPORT : null];
  }

  timeToWithdrawalFrame(frame: number): number {
    const genesisTime = this.genesisTimeService.getGenesisTime();
    const epochOfNextReport = this.contractConfig.getInitialEpoch() + frame * EPOCH_PER_FRAME;
    const timeToNextReport = epochOfNextReport * SECONDS_PER_SLOT * SLOTS_PER_EPOCH;

    return Math.round(genesisTime + timeToNextReport - Date.now() / 1000) * 1000; // in ms
  }

  async calculateFrameExitValidatorsCase(unfinalizedETH: BigNumber): Promise<number> {
    // latest epoch of most late to exit validators
    const latestEpoch = this.validators.getMaxExitEpoch();
    const totalValidators = this.validators.getTotal();

    // max number limit of create or remove validators per epoch
    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);

    // calculate additional source of eth, rewards accumulated each epoch
    const rewardsPerDay = await this.rewardsStorage.getRewardsPerFrame();
    const rewardsPerEpoch = rewardsPerDay.div(EPOCH_PER_FRAME);

    // number of epochs to finalize all eth
    const lidoQueueInEpoch = unfinalizedETH.div(MAX_EFFECTIVE_BALANCE.mul(Math.floor(churnLimit)).add(rewardsPerEpoch));

    // time to find validators for removing
    const sweepingMean = BigNumber.from(totalValidators)
      .div(BigNumber.from(MAX_WITHDRAWALS_PER_PAYLOAD).mul(SLOTS_PER_EPOCH))
      .div(2);
    const potentialExitEpoch = BigNumber.from(latestEpoch).add(lidoQueueInEpoch).add(sweepingMean);
    return this.genesisTimeService.getFrameOfEpoch(potentialExitEpoch.toNumber()) + 1;
  }

  async calculateFrameExitValidatorsCaseWithVEBO(unfinalizedETH: BigNumber): Promise<number> {
    // latest epoch of most late to exit validators
    const latestEpoch = this.validators.getMaxExitEpoch();
    const totalValidators = this.validators.getTotal();

    // calculate additional source of eth, rewards accumulated each epoch
    const rewardsPerDay = await this.rewardsStorage.getRewardsPerFrame();
    const rewardsPerEpoch = rewardsPerDay.div(EPOCH_PER_FRAME);
    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);

    // time to find validators for removing
    const sweepingMean = BigNumber.from(totalValidators)
      .div(BigNumber.from(MAX_WITHDRAWALS_PER_PAYLOAD).mul(SLOTS_PER_EPOCH))
      .div(2);

    const rewardsPerFrameVEBO = rewardsPerEpoch.mul(this.contractConfig.getEpochsPerFrameVEBO()); // each 8 hours
    const maxValidatorExitRequestsPerFrameVEBO = this.contractConfig.getMaxValidatorExitRequestsPerReport();
    const churnLimitPerFrameVEBO = BigNumber.from(Math.floor(churnLimit)).mul(
      this.contractConfig.getEpochsPerFrameVEBO(),
    );
    const limitValidators = Math.min(churnLimitPerFrameVEBO.toNumber(), maxValidatorExitRequestsPerFrameVEBO);

    const validatorsExitReportsCountBigNumber = unfinalizedETH
      .mul(10000)
      .div(MAX_EFFECTIVE_BALANCE.mul(limitValidators).add(rewardsPerFrameVEBO));

    const validatorsExitReportsCount = BigNumber.from(
      Math.ceil(validatorsExitReportsCountBigNumber.toNumber() / 10000),
    );
    const potentialExitEpochWithVEBOLimit = BigNumber.from(latestEpoch)
      .add(validatorsExitReportsCount.mul(this.contractConfig.getEpochsPerFrameVEBO()))
      .add(sweepingMean);

    this.logger.debug({
      potentialExitEpochWithVEBOLimit: potentialExitEpochWithVEBOLimit.toString(),
    });

    return this.genesisTimeService.getFrameOfEpoch(potentialExitEpochWithVEBOLimit.toNumber()) + 1;
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
