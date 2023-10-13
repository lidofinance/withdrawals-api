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
import { WithdrawalRequest } from '../../storage/queue-info/queue-info.types';

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

    const requestsCount = this.queueInfo.getUnfinalizedRequestsCount();

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

    const buffer = this.queueInfo.getDepositableEther();

    const [toTimeWithdrawal, toTimeWithdrawalVEBO] = await this.calculateWithdrawalTimeV2(
      additionalStETH,
      queueStETH,
      buffer,
      Date.now(),
    );

    const requestsCount = this.queueInfo.getUnfinalizedRequestsCount();

    return {
      ms: toTimeWithdrawal,
      withdrawalAt: new Date(Date.now() + toTimeWithdrawal).toISOString(),
      stethLastUpdate,
      validatorsLastUpdate,
      steth: unfinalizedETH.toString(),
      requests: requestsCount.toNumber(),
      withVEBO: {
        ms: toTimeWithdrawalVEBO,
        withdrawalAt: toTimeWithdrawalVEBO ? new Date(Date.now() + toTimeWithdrawalVEBO).toISOString() : null,
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

    const queueStETH = this.calculateUnfinalizedEthForRequestId(requests, request);
    if (!queueStETH) return null;

    const buffer = this.queueInfo.getBufferedEther().sub(queueStETH).add(request.amountOfStETH);

    const requestTimestamp = request.timestamp.toNumber() * 1000;
    const [toTimeWithdrawal, toTimeWithdrawalVEBO] = await this.calculateWithdrawalTimeV2(
      request.amountOfStETH,
      queueStETH,
      buffer,
      requestTimestamp,
    );

    return {
      requestId: request.id.toString(),
      ms: toTimeWithdrawal,
      withdrawalAt: new Date(requestTimestamp + toTimeWithdrawal).toISOString(),
      withVEBO: {
        ms: toTimeWithdrawalVEBO,
        withdrawalAt: toTimeWithdrawalVEBO ? new Date(requestTimestamp + toTimeWithdrawalVEBO).toISOString() : null,
      },
    };
  }

  calculateUnfinalizedEthForRequestId(requests: WithdrawalRequest[], request: WithdrawalRequest) {
    let unfinalizedETH = BigNumber.from(0);
    for (const r of requests) {
      unfinalizedETH = unfinalizedETH.add(r.amountOfStETH);

      if (r.id.eq(request.id)) {
        break;
      }
    }

    return unfinalizedETH;
  }

  async calculateWithdrawalTimeV2(
    withdrawalEth: BigNumber,
    unfinalizedETH: BigNumber,
    buffer: BigNumber,
    requestTimestamp: number,
  ) {
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
    let frameByBuffer: number = null;
    let frameByOnlyRewards: number = null;
    let frameByExitValidators: number = null;
    let frameByExitValidatorsWithVEBO: number = null;

    this.logger.debug({ buffer: buffer.toString(), withdrawalEth: withdrawalEth.toString() });
    // enough depositable ether
    if (buffer.gt(withdrawalEth)) {
      frameByBuffer = currentFrame + 1;
      this.logger.debug(`case buffer gt withdrawalEth, frameByBuffer: ${frameByBuffer}`);
    } else {
      frameByOnlyRewards = this.calculateFrameByRewardsOnly(unfinalizedETH);
      this.logger.debug(`case calculate by rewards only, frameByOnlyRewards: ${frameByOnlyRewards}`);
    }

    const requestTimestampFrame = this.genesisTimeService.getFrameByTimestamp(requestTimestamp) + 1;

    // postpone withdrawal request which is too close to report
    if (
      frameByBuffer !== null &&
      this.genesisTimeService.timeToWithdrawalFrame(requestTimestampFrame, requestTimestamp) <
        this.contractConfig.getRequestTimestampMargin()
    ) {
      this.logger.debug('case result < RequestTimestampMargin');
      frameByBuffer = currentFrame + 2;
    }

    // if none of up cases worked use long period calculation
    if (frameByBuffer === null) {
      this.logger.debug('case calculateFrameExitValidatorsCase');
      frameByExitValidators = await this.calculateFrameExitValidatorsCase(unfinalizedETH);
      frameByExitValidatorsWithVEBO = await this.calculateFrameExitValidatorsCaseWithVEBO(unfinalizedETH);
    }

    this.logger.debug({ frameByBuffer, frameByOnlyRewards, frameByExitValidators, frameByExitValidatorsWithVEBO });

    const result = this.genesisTimeService.timeToWithdrawalFrame(
      Math.min(...[frameByBuffer, frameByOnlyRewards, frameByExitValidators].filter(Boolean)),
      requestTimestamp,
    );

    const result2 = frameByExitValidatorsWithVEBO
      ? this.genesisTimeService.timeToWithdrawalFrame(frameByExitValidatorsWithVEBO, requestTimestamp)
      : null;

    return [result + GAP_AFTER_REPORT, result2 ? result2 + GAP_AFTER_REPORT : null];
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
    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);

    // calculate additional source of eth, rewards accumulated each epoch
    const rewardsPerDay = await this.rewardsStorage.getRewardsPerFrame();
    const rewardsPerEpoch = rewardsPerDay.div(EPOCH_PER_FRAME);

    const maxValidatorExitRequestsPerFrameVEBO = this.contractConfig.getMaxValidatorExitRequestsPerReport();
    const epochsPerFrameVEBO = this.contractConfig.getEpochsPerFrameVEBO();

    const lidoQueueInEpochBeforeVEBOExitLimit = unfinalizedETH.div(
      MAX_EFFECTIVE_BALANCE.mul(Math.floor(churnLimit)).add(rewardsPerEpoch),
    );

    const exitValidators = lidoQueueInEpochBeforeVEBOExitLimit.mul(Math.floor(churnLimit));
    const VEBOFramesCount = exitValidators.div(maxValidatorExitRequestsPerFrameVEBO);
    const lidoQueueInEpoch = lidoQueueInEpochBeforeVEBOExitLimit.add(VEBOFramesCount.mul(epochsPerFrameVEBO));

    // time to find validators for removing
    const sweepingMean = BigNumber.from(totalValidators)
      .div(BigNumber.from(MAX_WITHDRAWALS_PER_PAYLOAD).mul(SLOTS_PER_EPOCH))
      .div(2);
    const potentialExitEpoch = BigNumber.from(latestEpoch).add(lidoQueueInEpoch).add(sweepingMean);
    return this.genesisTimeService.getFrameOfEpoch(potentialExitEpoch.toNumber()) + 1;
  }

  public calculateRequestTime(unfinalizedETH: BigNumber): number {
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

  protected calculateFrameByRewardsOnly(unfinilizedEth: BigNumber) {
    const rewardsPerDay = this.rewardsStorage.getRewardsPerFrame();
    const rewardsPerEpoch = rewardsPerDay.div(EPOCH_PER_FRAME);

    const onlyRewardPotentialEpoch = unfinilizedEth.div(rewardsPerEpoch);

    return (
      this.genesisTimeService.getFrameOfEpoch(
        this.genesisTimeService.getCurrentEpoch() + onlyRewardPotentialEpoch.toNumber(),
      ) + 1
    );
  }

  protected validate(params: RequestTimeOptionsDto) {
    if (!this.queueInfo.getMinStethAmount()) return;

    const minAmount = formatEther(this.queueInfo.getMinStethAmount());
    const isValidAmount = maxMinNumberValidation(params.amount, minAmount);
    const isNeedValidate = params.amount && Number(params.amount) !== 0;

    if (isNeedValidate && !isValidAmount.isValid) {
      throw new BadRequestException(isValidAmount.message);
    }
  }
}
