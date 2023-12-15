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
import { GenesisTimeService, SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';

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
import { RequestsTimeOptionsDto } from './dto/requests-time-options.dto';
import { FAR_FUTURE_EPOCH } from '../../jobs/validators/validators.constants';
import { Lido, LIDO_CONTRACT_TOKEN, WITHDRAWAL_QUEUE_CONTRACT_TOKEN, WithdrawalQueue } from '@lido-nestjs/contracts';
import { RewardsService } from '../../events/rewards';

@Injectable()
export class RequestTimeService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contractWithdrawal: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    protected readonly validators: ValidatorsStorageService,
    protected readonly queueInfo: QueueInfoStorageService,
    protected readonly configService: ConfigService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly rewardsStorage: RewardsStorageService,
    protected readonly rewardsService: RewardsService,
    protected readonly contractConfig: ContractConfigStorageService,
  ) {}

  async getRequestTime(params: RequestTimeOptionsDto): Promise<RequestTimeDto | null> {
    this.validateRequestTimeOptions(params);

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

  async getRequestTimeV2(
    amount: string,
    unfinalized?: BigNumber,
    depositable?: BigNumber,
    vaultsBalance?: BigNumber,
  ): Promise<RequestTimeV2Dto | null> {
    const nextCalculationAt = this.queueInfo.getNextUpdate().toISOString();
    const validatorsLastUpdate = this.validators.getLastUpdate();
    const unfinalizedETH = unfinalized ?? (await this.contractWithdrawal.unfinalizedStETH()); // do runtime request if empty param
    const depositableETH = depositable ?? (await this.contractLido.getDepositableEther()); // do runtime request if empty param
    const vaultsBalanceETH = vaultsBalance ?? (await this.rewardsService.getVaultsBalance());

    if (!unfinalizedETH || !validatorsLastUpdate) {
      return {
        status: RequestTimeStatus.initializing,
        nextCalculationAt,
        requestInfo: null,
      };
    }

    const additionalStETH = parseEther(amount || '0');
    const queueStETH = unfinalizedETH.add(additionalStETH);

    const latestEpoch = this.validators.getMaxExitEpoch();

    const { ms, type } = await this.calculateWithdrawalTimeV2(
      queueStETH,
      depositableETH.add(vaultsBalanceETH),
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

  async getTimeByRequestId(
    requestId: string,
    unfinalized: BigNumber,
    buffer: BigNumber,
    depositable: BigNumber,
    vaultsBalance: BigNumber,
  ): Promise<RequestTimeByRequestIdDto | null> {
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

    if (requests.length === 0 && BigNumber.from(requestId).lt(lastRequestId)) {
      return {
        nextCalculationAt,
        status: RequestTimeStatus.finalized,
        requestInfo: null,
      };
    }

    const firstRequestId = requests[0]?.id;
    if (firstRequestId && BigNumber.from(requestId).lt(firstRequestId)) {
      return {
        nextCalculationAt,
        status: RequestTimeStatus.finalized,
        requestInfo: null,
      };
    }

    const request = requests.find((wr) => wr.id.eq(BigNumber.from(requestId)));

    const maxExitEpoch = this.validators.getMaxExitEpoch();
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();

    if (!request && BigNumber.from(requestId).gte(lastRequestId)) {
      // for not found requests return calculating status with 0 eth
      const lastRequestResult: RequestTimeByRequestIdDto = await this.getRequestTimeV2(
        '0',
        unfinalized,
        depositable,
        vaultsBalance,
      );
      lastRequestResult.status = RequestTimeStatus.calculating;
      lastRequestResult.requestInfo.requestId = requestId;
      return lastRequestResult;
    }

    const queueStETH = this.calculateUnfinalizedEthForRequestId(requests, request);
    const depositableForRequest = buffer.add(vaultsBalance).sub(queueStETH).add(request.amountOfStETH);
    const requestTimestamp = request.timestamp.toNumber() * 1000;
    const currentExitValidatorsDiffEpochs = Number(maxExitEpoch) - currentEpoch;
    const maxExitEpochInPast =
      this.genesisTimeService.getEpochByTimestamp(request.timestamp.toNumber() * 1000) +
      currentExitValidatorsDiffEpochs;

    let { ms, type } = await this.calculateWithdrawalTimeV2(
      queueStETH,
      depositableForRequest,
      requestTimestamp,
      maxExitEpochInPast.toString(),
    );

    const requestDto = transformToRequestDto(request);

    if (requestTimestamp + ms - Date.now() < 0) {
      // if calculation wrong points to past then validators is not excited in time
      // we need recalculate
      const recalculatedResult = await this.calculateWithdrawalTimeV2(
        queueStETH,
        depositableForRequest,
        requestTimestamp,
        maxExitEpoch.toString(),
      );

      ms = recalculatedResult.ms;
      type = recalculatedResult.type;
    }

    return {
      requestInfo: {
        requestId: requestDto.id,
        requestedAt: requestDto.timestamp,
        finalizationIn: requestTimestamp + ms - Date.now(),
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
    unfinalized: BigNumber, // including withdrawal eth
    depositable: BigNumber,
    requestTimestamp: number,
    latestEpoch: string,
  ) {
    let currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());
    let frameByBuffer = null;
    let frameByOnlyRewards = null;
    let frameByExitValidatorsWithVEBO = null;

    // gap after finalization check
    const frameGapBeforeFinalization = this.genesisTimeService.getFrameByTimestamp(Date.now() - GAP_AFTER_REPORT);
    if (frameGapBeforeFinalization !== currentFrame) {
      currentFrame--;
    }

    // enough depositable ether
    if (depositable.gt(unfinalized)) {
      frameByBuffer = { value: currentFrame + 1, type: RequestTimeCalculationType.buffer };
      this.logger.debug(`case buffer gt unfinalized, frameByBuffer`, frameByBuffer);
    }

    // postpone withdrawal request which is too close to report
    if (
      frameByBuffer !== null &&
      this.genesisTimeService.timeToWithdrawalFrame(currentFrame + 1, requestTimestamp) <
        this.contractConfig.getRequestTimestampMargin()
    ) {
      this.logger.debug('case result < RequestTimestampMargin');
      frameByBuffer = { value: currentFrame + 2, type: RequestTimeCalculationType.requestTimestampMargin };
    }

    if (!this.rewardsStorage.getRewardsPerFrame().eq(0) && frameByBuffer === null) {
      frameByOnlyRewards = {
        value: this.calculateFrameByRewardsOnly(unfinalized.sub(depositable)),
        type: RequestTimeCalculationType.rewardsOnly,
      };
      this.logger.debug(`case calculate by rewards only`, frameByOnlyRewards);
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

    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();

    // calculate additional source of eth, rewards accumulated each epoch
    const rewardsPerDay = await this.rewardsStorage.getRewardsPerFrame();
    const rewardsPerEpoch = rewardsPerDay.div(epochPerFrame);

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
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    const rewardsPerDay = this.rewardsStorage.getRewardsPerFrame();
    if (rewardsPerDay.eq(0)) {
      return FAR_FUTURE_EPOCH;
    }

    const rewardsPerEpoch = rewardsPerDay.div(epochPerFrame);
    const onlyRewardPotentialEpoch = unfinilized.div(rewardsPerEpoch);

    return (
      this.genesisTimeService.getFrameOfEpoch(
        this.genesisTimeService.getCurrentEpoch() + onlyRewardPotentialEpoch.toNumber(),
      ) + 1
    );
  }

  async getTimeRequests(requestOptions: RequestsTimeOptionsDto) {
    const [unfinalized, buffer, depositable, vaultsBalance] = await Promise.all([
      this.contractWithdrawal.unfinalizedStETH(),
      this.contractLido.getBufferedEther(),
      this.contractLido.getDepositableEther(),
      this.rewardsService.getVaultsBalance(),
    ]);

    return Promise.all(
      requestOptions.ids.map((id) => this.getTimeByRequestId(id, unfinalized, buffer, depositable, vaultsBalance)),
    );
  }

  public validateRequestTimeOptions(params: RequestTimeOptionsDto) {
    if (!this.queueInfo.getMinStethAmount()) return;

    const minAmount = formatEther(this.queueInfo.getMinStethAmount());
    const isValidAmount = maxMinNumberValidation(params.amount, minAmount);
    const isNeedValidate = params.amount && Number(params.amount) !== 0;

    if (isNeedValidate && !isValidAmount.isValid) {
      throw new BadRequestException(isValidAmount.message);
    }
  }
}
