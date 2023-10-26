import { BadRequestException, Inject, Injectable, LoggerService } from '@nestjs/common';
import {
  ContractConfigStorageService,
  QueueInfoStorageService,
  RewardsStorageService,
  ValidatorsStorageService,
} from 'storage';
import { BigNumber } from '@ethersproject/bignumber';

import { formatEther, parseEther } from '@ethersproject/units';
import { ConfigService } from 'common/config';
import { EPOCH_PER_FRAME, GenesisTimeService, SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';

import {
  CHURN_LIMIT_QUOTIENT,
  GAP_AFTER_REPORT,
  MAX_EFFECTIVE_BALANCE,
  MAX_WITHDRAWALS_PER_PAYLOAD,
  MIN_PER_EPOCH_CHURN_LIMIT,
} from './request-time.constants';
import { maxMinNumberValidation } from './request-time.utils';
import { RequestTimeDto, RequestTimeOptionsDto } from './dto';
import { RequestTimeV2Dto } from './dto/request-time-v2.dto';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { RequestTimeByRequestIdDto } from './dto/request-time-by-request-id.dto';
import { WithdrawalRequest } from '../../storage/queue-info/queue-info.types';
import { transformToRequestDto } from './dto/request.dto';
import { RequestTimeStatus } from './dto/request-time-status';
import { RequestTimeCalculationType } from './dto/request-time-calculation-type';

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
    const nextCalculationAt = this.queueInfo.getNextUpdate().toISOString();

    const validatorsLastUpdate = this.validators.getLastUpdate();
    const unfinalizedETH = this.queueInfo.getStETH();

    if (!unfinalizedETH || !validatorsLastUpdate) {
      return {
        status: RequestTimeStatus.initializing,
        nextCalculationAt,
        requestInfo: null,
      };
    }

    const additionalStETH = parseEther(params.amount || '0');
    const queueStETH = unfinalizedETH.add(additionalStETH);

    const buffer = this.queueInfo.getDepositableEther();
    const latestEpoch = this.validators.getMaxExitEpoch();

    const { ms, type } = await this.calculateWithdrawalTimeV2(
      additionalStETH,
      queueStETH,
      buffer,
      Date.now(),
      latestEpoch,
    );

    return {
      requestInfo: {
        finalizationIn: ms,
        finalizationAt: new Date(Date.now() + ms).toISOString(),
        type,
      },
      status: RequestTimeStatus.calculated,
      nextCalculationAt,
    };
  }

  async getTimeByRequestId(requestId: string): Promise<RequestTimeByRequestIdDto | null> {
    const requests = this.queueInfo.getRequests();
    const validatorsLastUpdate = this.validators.getLastUpdate();
    const queueInfoLastUpdate = this.queueInfo.getLastUpdate();

    if (!validatorsLastUpdate || !queueInfoLastUpdate || !requests) {
      return {
        requestInfo: null,
        status: RequestTimeStatus.initializing,
        nextCalculationAt: null,
      };
    }

    const nextCalculationAt = this.queueInfo.getNextUpdate().toISOString();

    const lastRequestId = this.queueInfo.getLastRequestId();
    if (BigNumber.from(requestId).gt(lastRequestId)) {
      return {
        nextCalculationAt,
        status: RequestTimeStatus.calculating,
        requestInfo: null,
      };
    }

    const firstRequestId = requests[0]?.id ?? lastRequestId;
    if (BigNumber.from(requestId).lte(firstRequestId)) {
      return {
        nextCalculationAt,
        status: RequestTimeStatus.finalized,
        requestInfo: null,
      };
    }

    const request = requests.find((wr) => wr.id.eq(BigNumber.from(requestId)));
    const queueStETH = this.calculateUnfinalizedEthForRequestId(requests, request);
    const buffer = this.queueInfo.getBufferedEther().sub(queueStETH).add(request.amountOfStETH);
    const requestTimestamp = request.timestamp.toNumber() * 1000;

    const maxExitEpoch = this.validators.getMaxExitEpoch();
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();
    const currentExitValidatorsDiffEpochs = Number(maxExitEpoch) - currentEpoch;
    const latestEpoch =
      this.genesisTimeService.getEpochByTimestamp(request.timestamp.toNumber()) + currentExitValidatorsDiffEpochs;

    const { ms, type } = await this.calculateWithdrawalTimeV2(
      request.amountOfStETH,
      queueStETH,
      buffer,
      requestTimestamp,
      latestEpoch.toString(),
    );

    const requestDto = transformToRequestDto(request);

    return {
      requestInfo: {
        requestId: requestDto.id,
        requestedAt: requestDto.timestamp,
        finalizationIn: ms,
        finalizationAt: new Date(requestTimestamp + ms).toISOString(),
        type,
      },
      status: RequestTimeStatus.calculated,
      nextCalculationAt,
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
    unfinalized: BigNumber,
    depositable: BigNumber,
    requestTimestamp: number,
    latestEpoch: string,
  ) {
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
    let frameByBuffer = null;
    let frameByOnlyRewards = null;
    let frameByExitValidatorsWithVEBO = null;

    this.logger.debug({ buffer: depositable.toString(), withdrawalEth: withdrawalEth.toString() });
    // enough depositable ether
    if (depositable.gt(withdrawalEth)) {
      frameByBuffer = { value: currentFrame + 1, type: RequestTimeCalculationType.buffer };
      this.logger.debug(`case buffer gt withdrawalEth, frameByBuffer: ${frameByBuffer}`);
    } else {
      frameByOnlyRewards = {
        value: this.calculateFrameByRewardsOnly(unfinalized),
        type: RequestTimeCalculationType.rewardsOnly,
      };
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
      frameByBuffer = { value: currentFrame + 2, type: RequestTimeCalculationType.requestTimestampMargin };
    }

    // if none of up cases worked use long period calculation
    if (frameByBuffer === null) {
      const valueVebo = await this.calculateFrameExitValidatorsCaseWithVEBO(unfinalized, latestEpoch);
      frameByExitValidatorsWithVEBO = { value: valueVebo, type: RequestTimeCalculationType.exitValidators };
    }

    const minFrameObject = [frameByBuffer, frameByOnlyRewards, frameByExitValidatorsWithVEBO]
      .filter((f) => Boolean(f))
      .reduce((prev, curr) => (prev.value < curr.value ? prev : curr));
    const result = this.genesisTimeService.timeToWithdrawalFrame(minFrameObject.value, requestTimestamp);

    return {
      ms: result ? result + GAP_AFTER_REPORT : null,
      type: minFrameObject.type,
    };
  }

  async calculateFrameExitValidatorsCaseWithVEBO(unfinalizedETH: BigNumber, latestEpoch: string): Promise<number> {
    // latest epoch of most late to exit validators
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

  protected calculateFrameByRewardsOnly(unfinilized: BigNumber) {
    const rewardsPerDay = this.rewardsStorage.getRewardsPerFrame();
    const rewardsPerEpoch = rewardsPerDay.div(EPOCH_PER_FRAME);

    const onlyRewardPotentialEpoch = unfinilized.div(rewardsPerEpoch);

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
