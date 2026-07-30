import { Inject, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { parseEther } from 'ethers';

import {
  ContractConfigStorageService,
  QueueInfoStorageService,
  RewardsStorageService,
  ValidatorsStorageService,
} from 'storage';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { GenesisTimeService } from 'common/genesis-time';
import { PrometheusService } from 'common/prometheus';

import { GAP_AFTER_REPORT, MIN_ACTIVATION_BALANCE, WITHDRAWAL_BUNKER_DELAY_FRAMES } from './waiting-time.constants';
import {
  validateTimeResponseWithFallback,
  calculateUnfinalizedEthToRequestId,
  calculateFrameByValidatorBalances,
} from './utils';
import { transformToRequestDto } from './dto';
import {
  WaitingTimeStatus,
  CheckInPastCaseArgs,
  CalculateWaitingTimeV2Args,
  WaitingTimeCalculationType,
  CalculateWaitingTimeV2Result,
  GetWaitingTimeInfoByIdResult,
  GetWaitingTimeInfoByIdArgs,
  GetWaitingTimeInfoV2Args,
  GetWaitingTimeInfoV2Result,
} from './waiting-time.types';
import { toEth } from '../common/utils/to-eth';
import { MAX_SEED_LOOKAHEAD } from '../jobs/validators';
import { BlockStateCacheService } from './block-state-cache.service';

@Injectable()
export class WaitingTimeService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly validators: ValidatorsStorageService,
    protected readonly contractConfig: ContractConfigStorageService,
    protected readonly rewardsStorage: RewardsStorageService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly queueInfo: QueueInfoStorageService,
    protected readonly prometheusService: PrometheusService,
    protected readonly blockStateCache: BlockStateCacheService,
  ) {}

  // preparing all needed number for calculation withdrawal time
  public async getWaitingTimeInfo(args: GetWaitingTimeInfoV2Args): Promise<GetWaitingTimeInfoV2Result> {
    const { amount, cached } = args;

    if (this.checkIsInitializing()) {
      return {
        status: WaitingTimeStatus.initializing,
        nextCalculationAt: null,
        requestInfo: null,
      };
    }

    // nextCalculationAt not needed anymore due to runtime queries to contract
    const nextCalculationAt = this.queueInfo.getNextUpdate().toISOString();

    const { unfinalized, buffer, vaultsBalance } = cached ?? (await this.blockStateCache.getBlockState());

    this.prometheusService.balancesStateUnfinalized.set(toEth(unfinalized).toNumber());
    this.prometheusService.balancesStateBuffer.set(toEth(buffer).toNumber());
    this.prometheusService.balancesStateVaults.set(toEth(vaultsBalance).toNumber());

    const additionalStETH = parseEther(amount || '0');
    const queueStETH = unfinalized.add(additionalStETH);

    const maxExitEpoch = this.getMaxExitEpoch();

    const { frame, type } = await this.calculateWithdrawalFrame({
      unfinalized: queueStETH,
      vaultsBalance,
      buffer,
      requestTimestamp: Date.now(),
      latestEpoch: maxExitEpoch.toString(),
    });
    const ms = this.genesisTimeService.timeToWithdrawalFrame(frame, Date.now());
    const finalizationIn = validateTimeResponseWithFallback(ms) + GAP_AFTER_REPORT;

    return {
      requestInfo: {
        finalizationIn,
        finalizationAt: new Date(Date.now() + finalizationIn).toISOString(),
        type,
      },
      status: WaitingTimeStatus.calculated,
      nextCalculationAt,
    };
  }

  public async getWaitingTimeInfoById(args: GetWaitingTimeInfoByIdArgs): Promise<GetWaitingTimeInfoByIdResult> {
    const { requestId, unfinalized, buffer, vaultsBalance } = args;
    const requests = this.queueInfo.getRequests();

    const isInitializing = this.checkIsInitializing();
    if (isInitializing) return isInitializing;

    const isEmptyQueue = this.checkIsEmptyQueue(requestId);
    if (isEmptyQueue) return isEmptyQueue;

    const isFinalized = this.checkIsFinalized(requestId);
    if (isFinalized) return isFinalized;

    const isNotInQueueYet = await this.checkIsNotInQueueYet(requestId, unfinalized, buffer, vaultsBalance);
    if (isNotInQueueYet) return isNotInQueueYet;

    const nextCalculationAt = this.queueInfo.getNextUpdate().toISOString();
    const request = requests.find((item) => item.id.eq(BigNumber.from(requestId)));

    const maxExitEpoch = this.getMaxExitEpoch();
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();

    const queueStETH = calculateUnfinalizedEthToRequestId(requests, request);
    const requestTimestamp = request.timestamp.toNumber() * 1000;

    const currentExitValidatorsDiffEpochs = Math.max(Number(maxExitEpoch) - currentEpoch, MAX_SEED_LOOKAHEAD);
    const maxExitEpochInPast =
      this.genesisTimeService.getEpochByTimestamp(requestTimestamp) + currentExitValidatorsDiffEpochs;

    const { frame, type: precalculatedType } = await this.calculateWithdrawalFrame({
      unfinalized: queueStETH,
      buffer,
      vaultsBalance,
      requestTimestamp,
      latestEpoch: maxExitEpochInPast.toString(),
    });

    const { type, finalizationIn } = await this.checkInPastCase({
      request,
      vaultsBalance,
      buffer,
      frame,
      type: precalculatedType,
    });
    const requestDto = transformToRequestDto(request);

    return {
      requestInfo: {
        requestId: requestDto.id,
        requestedAt: requestDto.timestamp,
        finalizationIn: requestTimestamp + finalizationIn - Date.now(),
        finalizationAt: new Date(requestTimestamp + finalizationIn).toISOString(),
        type,
      },
      status: WaitingTimeStatus.calculated,
      nextCalculationAt,
    };
  }

  public async calculateWithdrawalFrame(args: CalculateWaitingTimeV2Args): Promise<CalculateWaitingTimeV2Result> {
    const { unfinalized, buffer, vaultsBalance, requestTimestamp, latestEpoch } = args;

    const fullBuffer = buffer.add(vaultsBalance);
    let currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());

    const frameIsBunker = this.getFrameIsBunker();
    if (frameIsBunker) {
      return { frame: frameIsBunker, type: WaitingTimeCalculationType.bunker };
    }

    // gap after finalization check
    const frameGapBeforeFinalization = this.genesisTimeService.getFrameByTimestamp(Date.now() - GAP_AFTER_REPORT);
    if (frameGapBeforeFinalization !== currentFrame) {
      currentFrame--;
    }

    const isRequestShouldBePostponed =
      this.genesisTimeService.timeToWithdrawalFrame(currentFrame + 1, requestTimestamp) <
      this.contractConfig.getRequestTimestampMargin();

    // enough buffer ether
    if (buffer.gt(unfinalized)) {
      if (isRequestShouldBePostponed) {
        return { frame: currentFrame + 2, type: WaitingTimeCalculationType.requestTimestampMargin };
      } else {
        return { frame: currentFrame + 1, type: WaitingTimeCalculationType.buffer };
      }
    }

    // enough buffer and vaults balance
    if (fullBuffer.gt(unfinalized)) {
      if (isRequestShouldBePostponed) {
        return { frame: currentFrame + 2, type: WaitingTimeCalculationType.requestTimestampMargin };
      } else {
        return { frame: currentFrame + 1, type: WaitingTimeCalculationType.vaultsBalance };
      }
    }

    // takes min from next 3 cases:
    // rewards only
    let frameByOnlyRewards: CalculateWaitingTimeV2Result | null = null;
    // validators with withdrawable_epoch + rewards
    let frameValidatorsBalances: CalculateWaitingTimeV2Result | null = null;
    // exit validators + rewards (todo: add here case validators with withdrawable_epoch)
    let frameByExitValidatorsWithVEBO: CalculateWaitingTimeV2Result | null = null;

    // Per-frame rewards rate net of the deposits-reserve refill claim. Governance sets a target
    // value the protocol resets `depositsReserve` to at every oracle report; up to `target` ETH
    // worth of fresh rewards is locked into the reserve before any of it becomes available for
    // withdrawals. Conservative netting: assume worst-case where reserve fully drains between
    // reports, so the per-frame claim is min(target, rewardsPerFrame). When target=0 (pre-SR-3
    // or governance hasn't set one), this is a no-op.
    const rewardsPerFrame = this.rewardsStorage.getRewardsPerFrame();
    const depositsReserveTarget = this.contractConfig.getDepositsReserveTarget();
    const reservedRefillPerFrame = depositsReserveTarget.gt(rewardsPerFrame) ? rewardsPerFrame : depositsReserveTarget;
    const rewardsAvailableForWithdrawals = rewardsPerFrame.sub(reservedRefillPerFrame);

    // checked only rewards filling unfinalized
    const frameByOnlyRewardsValue = this.calculateFrameByRewardsOnly(
      unfinalized.sub(fullBuffer),
      rewardsAvailableForWithdrawals,
    );
    if (frameByOnlyRewardsValue) {
      frameByOnlyRewards = {
        frame: frameByOnlyRewardsValue,
        type: WaitingTimeCalculationType.rewardsOnly,
      };
    }

    // loop over all known frames with balances of withdrawing validators
    const frameBalances = this.validators.getFrameBalances();
    const valueFrameValidatorsBalance = calculateFrameByValidatorBalances({
      unfinilized: unfinalized.sub(fullBuffer),
      frameBalances,
      currentFrame,
      rewardsAvailableForWithdrawals,
    });

    if (valueFrameValidatorsBalance) {
      frameValidatorsBalances = {
        frame: valueFrameValidatorsBalance,
        type: WaitingTimeCalculationType.validatorBalances,
      };
    }

    // longest case for exit validators
    const valueFrameExitValidators = await this.calculateFrameExitValidatorsCaseWithVEBO(
      unfinalized.sub(fullBuffer),
      latestEpoch,
      rewardsAvailableForWithdrawals,
    );

    if (valueFrameExitValidators !== null) {
      frameByExitValidatorsWithVEBO = {
        frame: valueFrameExitValidators,
        type: WaitingTimeCalculationType.exitValidators,
      };
    }

    const minFrameObject = [frameValidatorsBalances, frameByOnlyRewards, frameByExitValidatorsWithVEBO]
      .filter((f) => Boolean(f))
      .reduce((prev, curr) => (prev.frame < curr.frame ? prev : curr));

    return minFrameObject;
  }

  private async calculateFrameExitValidatorsCaseWithVEBO(
    unfinalizedETH: BigNumber,
    latestEpoch: string,
    rewardsAvailableForWithdrawals: BigNumber,
  ): Promise<number | null> {
    const exitChurnLimit = this.validators.getExitChurnLimit();
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    const epochsPerFrameVEBO = this.contractConfig.getEpochsPerFrameVEBO();
    const rewardsPerEpoch = rewardsAvailableForWithdrawals.div(epochPerFrame);

    // ETH released by validator exits per epoch. Exit churn is stored in 32-ETH-equivalent
    // units, so multiplying by 32 ETH converts it back to wei throughput for the current fork.
    const exitChurnEthPerEpoch = MIN_ACTIVATION_BALANCE.mul(Math.floor(exitChurnLimit));
    const exitChurnEthPerVEBOFrame = exitChurnEthPerEpoch.mul(epochsPerFrameVEBO);

    // VEBO cap is governance-set in whole ETH per VEBO frame. Whichever is smaller — the
    // network's natural exit churn × frame duration, or the VEBO cap — bounds exit throughput.
    const maxBalanceExitRequestedPerReportInEth = this.contractConfig.getMaxBalanceExitRequestedPerReportInEth();
    // ethers v6 parseEther returns bigint; wrap in BigNumber for consistent typing with the
    // surrounding @ethersproject/bignumber arithmetic chain.
    const maxExitEthPerVEBOFrame = BigNumber.from(parseEther(maxBalanceExitRequestedPerReportInEth.toString()));
    const effectiveExitEthPerVEBOFrame = exitChurnEthPerVEBOFrame.lt(maxExitEthPerVEBOFrame)
      ? exitChurnEthPerVEBOFrame
      : maxExitEthPerVEBOFrame;

    // Rewards accrue continuously and don't go through the VEBO bottleneck.
    const rewardsEthPerVEBOFrame = rewardsPerEpoch.mul(epochsPerFrameVEBO);
    const totalEthPerVEBOFrame = effectiveExitEthPerVEBOFrame.add(rewardsEthPerVEBOFrame);

    // Cap is 0 (governance-pause via setMaxBalanceExitRequestedPerReportInEth) AND no rewards
    // means the queue cannot drain via this case at all. Skip; the caller treats null as
    // "case not applicable" and minimum is taken over the remaining cases.
    if (totalEthPerVEBOFrame.isZero()) {
      return null;
    }

    // adding 1 because of round-down BigNumber dividing
    const VEBOFrames = unfinalizedETH.div(totalEthPerVEBOFrame).add(1);
    const VEBOEpochs = VEBOFrames.mul(epochsPerFrameVEBO);

    const sweepingMean = this.validators.getSweepMeanEpochs();
    const potentialExitEpoch = BigNumber.from(latestEpoch).add(VEBOEpochs).add(sweepingMean);

    return this.genesisTimeService.getFrameOfEpoch(potentialExitEpoch.toNumber()) + 1;
  }

  public async calculateRequestsTime(ids: string[]) {
    const { unfinalized, buffer, vaultsBalance } = await this.blockStateCache.getBlockState();

    this.prometheusService.balancesStateUnfinalized.set(toEth(unfinalized).toNumber());
    this.prometheusService.balancesStateBuffer.set(toEth(buffer).toNumber());
    this.prometheusService.balancesStateVaults.set(toEth(vaultsBalance).toNumber());

    return Promise.all(
      ids.map((requestId) => this.getWaitingTimeInfoById({ requestId, unfinalized, buffer, vaultsBalance })),
    );
  }

  // Utilities methods

  private async checkInPastCase(args: CheckInPastCaseArgs) {
    const { request, vaultsBalance, buffer, type, frame } = args;

    const maxExitEpoch = this.getMaxExitEpoch();
    const requests = this.queueInfo.getRequests();
    const requestTimestamp = request.timestamp.toNumber() * 1000;
    const queueStETH = calculateUnfinalizedEthToRequestId(requests, request);
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());

    let currentType = type;
    let ms = this.genesisTimeService.timeToWithdrawalFrame(frame, requestTimestamp);
    let finalizationIn = validateTimeResponseWithFallback(ms) + GAP_AFTER_REPORT;
    const isInPast = requestTimestamp + finalizationIn - Date.now() < 0;

    if (isInPast) {
      this.logger.warn(
        `Request with id ${request.id} was calculated with finalisation in past (finalizationIn=${ms}, type=${currentType}) and going to be recalculated`,
      );
      // if calculation wrong points to past then validators is not excited in time
      // we need recalculate
      const recalculatedResult = await this.calculateWithdrawalFrame({
        unfinalized: queueStETH,
        buffer,
        vaultsBalance,
        requestTimestamp,
        latestEpoch: maxExitEpoch.toString(),
      });

      ms = this.genesisTimeService.timeToWithdrawalFrame(recalculatedResult.frame, requestTimestamp);
      finalizationIn = validateTimeResponseWithFallback(ms) + GAP_AFTER_REPORT;
      currentType = recalculatedResult.type;
    }

    const isInPastFallback = requestTimestamp + finalizationIn - Date.now() < 0;
    // temporary fallback for negative results, can be deleted after validator balances computation improvements
    if (isInPastFallback) {
      this.logger.warn(
        `Request with id ${request.id} was recalculated and finalisation still in past (recalculated finalizationIn=${ms}). Fallback to next frame`,
      );
      finalizationIn =
        this.genesisTimeService.timeToWithdrawalFrame(currentFrame + 1, requestTimestamp) + GAP_AFTER_REPORT;
    }

    return {
      type: currentType,
      finalizationIn,
    };
  }

  public checkIsInitializing() {
    const requests = this.queueInfo.getRequests();
    const validatorsLastUpdate = this.validators.getLastUpdate();
    const validatorsExitChurnLimit = this.validators.getExitChurnLimit();
    const queueInfoLastUpdate = this.queueInfo.getLastUpdate();
    const contractConfigLastUpdate = this.contractConfig.getLastUpdate();

    const isInitialized =
      validatorsLastUpdate && validatorsExitChurnLimit && queueInfoLastUpdate && requests && contractConfigLastUpdate;

    if (!isInitialized) {
      return {
        requestInfo: null,
        status: WaitingTimeStatus.initializing,
        nextCalculationAt: null,
      };
    } else return null;
  }

  private checkIsEmptyQueue(requestId: string) {
    const requests = this.queueInfo.getRequests();
    const nextCalculationAt = this.queueInfo.getNextUpdate().toISOString();
    const lastRequestId = this.queueInfo.getLastRequestId();

    const isEmptyQueue = requests.length === 0 && BigNumber.from(requestId).lt(lastRequestId);

    if (isEmptyQueue) {
      return {
        nextCalculationAt,
        status: WaitingTimeStatus.finalized,
        requestInfo: null,
      };
    } else return null;
  }

  private checkIsFinalized(requestId: string) {
    const requests = this.queueInfo.getRequests();
    const nextCalculationAt = this.queueInfo.getNextUpdate().toISOString();

    const firstRequestId = requests[0]?.id;
    const isFinalized = firstRequestId && BigNumber.from(requestId).lt(firstRequestId);

    if (isFinalized) {
      return {
        nextCalculationAt,
        status: WaitingTimeStatus.finalized,
        requestInfo: null,
      };
    } else return null;
  }

  private async checkIsNotInQueueYet(
    requestId: string,
    unfinalized: BigNumber,
    buffer: BigNumber,
    vaultsBalance: BigNumber,
  ): Promise<GetWaitingTimeInfoV2Result | null> {
    const requests = this.queueInfo.getRequests();
    const lastRequestId = this.queueInfo.getLastRequestId();

    const request = requests.find((item) => item.id.eq(BigNumber.from(requestId)));
    const isNotInQueueYet = !request && BigNumber.from(requestId).gte(lastRequestId);

    if (isNotInQueueYet) {
      // for not found requests return calculating status with 0 eth
      const lastRequestResult = await this.getWaitingTimeInfo({
        amount: '0',
        cached: {
          unfinalized,
          buffer,
          vaultsBalance,
        },
      });
      lastRequestResult.status = WaitingTimeStatus.calculating;
      lastRequestResult.requestInfo.requestId = requestId;

      return lastRequestResult;
    } else return null;
  }

  public calculateFrameByRewardsOnly(unfinalized: BigNumber, rewardsAvailableForWithdrawals: BigNumber) {
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    if (rewardsAvailableForWithdrawals.eq(0)) return null;

    const rewardsPerEpoch = rewardsAvailableForWithdrawals.div(epochPerFrame);
    const onlyRewardPotentialEpoch = unfinalized.div(rewardsPerEpoch);

    return (
      this.genesisTimeService.getFrameOfEpoch(
        this.genesisTimeService.getCurrentEpoch() + onlyRewardPotentialEpoch.toNumber(),
      ) + 1
    );
  }

  public getFrameIsBunker(): null | number {
    const isBunker = this.queueInfo.getBunkerModeActive();
    if (isBunker) {
      return (
        this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch()) +
        WITHDRAWAL_BUNKER_DELAY_FRAMES
      );
    }
    return null;
  }

  public calculateRequestTimeSimple(unfinalizedETH: BigNumber): number {
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();
    const maxExitEpoch = this.getMaxExitEpoch();
    // Exit churn is stored in 32-ETH-equivalent units. MIN_ACTIVATION_BALANCE × exitChurnLimit
    // converts that representation into ETH-per-epoch exit capacity in wei for the current fork.
    const churnLimit = this.validators.getExitChurnLimit();

    const lidoQueueInEpoch = unfinalizedETH.div(MIN_ACTIVATION_BALANCE.mul(Math.floor(churnLimit)));
    const sweepingMean = this.validators.getSweepMeanEpochs();
    const potentialExitEpoch = BigNumber.from(maxExitEpoch).add(lidoQueueInEpoch).add(sweepingMean);

    const waitingTime = potentialExitEpoch
      .sub(currentEpoch)
      .mul(this.genesisTimeService.getSecondsPerSlot())
      .mul(this.genesisTimeService.getSlotsPerEpoch())
      .div(60 * 60 * 24);

    return Math.round(waitingTime.toNumber());
  }

  // returns max exit epoch of validators with fallback to current epoch if max exit epoch already passed
  public getMaxExitEpoch() {
    const maxExitEpoch = this.validators.getMaxExitEpoch();
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();

    return Math.max(+maxExitEpoch, currentEpoch + MAX_SEED_LOOKAHEAD + 1);
  }
}
