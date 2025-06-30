import { Inject, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import {
  LIDO_CONTRACT_TOKEN,
  Lido,
  WITHDRAWAL_QUEUE_CONTRACT_TOKEN,
  WithdrawalQueue,
  LIDO_LOCATOR_CONTRACT_TOKEN,
  LidoLocator,
} from '@lido-nestjs/contracts';
import { parseEther } from 'ethers';

import {
  ContractConfigStorageService,
  QueueInfoStorageService,
  RewardsStorageService,
  ValidatorsStorageService,
} from 'storage';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { GenesisTimeService, SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';
import { PrometheusService } from 'common/prometheus';
import { RewardEventsService } from 'events/reward-events';

import {
  CHURN_LIMIT_QUOTIENT,
  GAP_AFTER_REPORT,
  MIN_ACTIVATION_BALANCE,
  MIN_PER_EPOCH_CHURN_LIMIT,
  WITHDRAWAL_BUNKER_DELAY_FRAMES,
} from './waiting-time.constants';
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
  CalculateWaitingTimeV2Result,
  GetWaitingTimeInfoByIdResult,
  GetWaitingTimeInfoByIdArgs,
  GetWaitingTimeInfoV2Args,
  GetWaitingTimeInfoV2Result,
} from './waiting-time.types';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { toEth } from '../common/utils/to-eth';
import { MAX_SEED_LOOKAHEAD } from '../jobs/validators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WithdrawalRequestInfoEntity } from './entities/withdrawal-request-info.entity';
import { WaitingTimeCalculationType } from './entities/withdrawal-time-calculation-type.enum';
import { OracleV2__factory } from '../common/contracts/generated';

@Injectable()
export class WaitingTimeService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contractWithdrawal: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    protected readonly validators: ValidatorsStorageService,
    protected readonly contractConfig: ContractConfigStorageService,
    protected readonly rewardsStorage: RewardsStorageService,
    protected readonly genesisTimeService: GenesisTimeService,
    protected readonly rewardsService: RewardEventsService,
    protected readonly queueInfo: QueueInfoStorageService,
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly prometheusService: PrometheusService,
    @InjectRepository(WithdrawalRequestInfoEntity)
    protected readonly withdrawalRequestInfoEntityRepository: Repository<WithdrawalRequestInfoEntity>,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,
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
    const blockNumber = await this.getLatestOrBlockProcessingRefSlot();

    const [unfinalized, buffer, vaultsBalance] = !cached
      ? await Promise.all([
          this.contractWithdrawal.unfinalizedStETH({ blockTag: blockNumber }),
          this.contractLido.getBufferedEther({ blockTag: blockNumber }),
          this.rewardsService.getVaultsBalance(blockNumber),
        ])
      : [cached.unfinalized, cached.buffer, cached.vaultsBalance];

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

    const frameIsBunker = await this.getFrameIsBunker();
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

    // checked only rewards filling unfinalized
    const frameByOnlyRewardsValue = this.calculateFrameByRewardsOnly(unfinalized.sub(fullBuffer));
    if (frameByOnlyRewardsValue) {
      frameByOnlyRewards = {
        frame: frameByOnlyRewardsValue,
        type: WaitingTimeCalculationType.rewardsOnly,
      };
    }

    // loop over all known frames with balances of withdrawing validators
    const frameBalances = this.validators.getFrameBalances();
    const rewardsPerFrame = this.rewardsStorage.getRewardsPerFrame();
    const valueFrameValidatorsBalance = calculateFrameByValidatorBalances({
      unfinilized: unfinalized.sub(fullBuffer),
      frameBalances,
      currentFrame,
      rewardsPerFrame,
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
    );

    frameByExitValidatorsWithVEBO = {
      frame: valueFrameExitValidators,
      type: WaitingTimeCalculationType.exitValidators,
    };

    const minFrameObject = [frameValidatorsBalances, frameByOnlyRewards, frameByExitValidatorsWithVEBO]
      .filter((f) => Boolean(f))
      .reduce((prev, curr) => (prev.frame < curr.frame ? prev : curr));

    return minFrameObject;
  }

  private async calculateFrameExitValidatorsCaseWithVEBO(
    unfinalizedETH: BigNumber,
    latestEpoch: string,
  ): Promise<number> {
    const churnLimit = this.validators.getChurnLimit();
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();

    // calculate additional source of eth, rewards accumulated each epoch
    const rewardsPerFrame = this.rewardsStorage.getRewardsPerFrame();
    const rewardsPerEpoch = rewardsPerFrame.div(epochPerFrame);

    const maxValidatorExitRequestsPerFrameVEBO = this.contractConfig.getMaxValidatorExitRequestsPerReport();
    const epochsPerFrameVEBO = this.contractConfig.getEpochsPerFrameVEBO();

    // number epochs needed for closing unfinalizedETH dividing on validator balances and rewards
    const lidoQueueInEpochBeforeVEBOExitLimit = unfinalizedETH.div(
      MIN_ACTIVATION_BALANCE.mul(Math.floor(churnLimit)).add(rewardsPerEpoch),
    );

    // number of validators to exit
    const exitValidators = lidoQueueInEpochBeforeVEBOExitLimit.mul(Math.floor(churnLimit));

    // Validator Exit Bus Oracle (VEBO) has max validator to exit per VEBO frame
    // according to this limitation, this is VEBO frames needed to exit
    // adding 1 because of round down BigNumber dividing
    const VEBOFrames = exitValidators.div(maxValidatorExitRequestsPerFrameVEBO).add(1);
    const VEBOEpochs = VEBOFrames.mul(epochsPerFrameVEBO);

    // time to find validators for exiting
    const sweepingMean = this.validators.getSweepMeanEpochs();

    // latestEpoch - epoch of last exiting validator in whole network
    // potential exit epoch - will be from latestEpoch, add VEBO epochs, add sweeping mean
    const potentialExitEpoch = BigNumber.from(latestEpoch).add(VEBOEpochs).add(sweepingMean);

    return this.genesisTimeService.getFrameOfEpoch(potentialExitEpoch.toNumber()) + 1;
  }

  public async calculateRequestsTime(ids: string[]) {
    const blockNumber = await this.getLatestOrBlockProcessingRefSlot();

    const [unfinalized, buffer, vaultsBalance] = await Promise.all([
      this.contractWithdrawal.unfinalizedStETH({ blockTag: blockNumber }),
      this.contractLido.getBufferedEther({ blockTag: blockNumber }),
      this.rewardsService.getVaultsBalance(blockNumber),
    ]);

    this.prometheusService.balancesStateUnfinalized.set(toEth(unfinalized).toNumber());
    this.prometheusService.balancesStateBuffer.set(toEth(buffer).toNumber());
    this.prometheusService.balancesStateVaults.set(toEth(vaultsBalance).toNumber());

    return Promise.all(
      ids.map((requestId) => this.getWaitingTimeInfoById({ requestId, unfinalized, buffer, vaultsBalance })),
    );
  }

  // Utilities methods

  private async checkInPastCase(args: CheckInPastCaseArgs) {
    const { request, type, frame } = args;

    const requestTimestamp = request.timestamp.toNumber() * 1000;
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());

    let currentType = type;
    const ms = this.genesisTimeService.timeToWithdrawalFrame(frame, requestTimestamp);
    let finalizationIn = validateTimeResponseWithFallback(ms) + GAP_AFTER_REPORT;
    const isInPast = requestTimestamp + finalizationIn - Date.now() < 0;

    if (isInPast) {
      this.logger.warn(
        `Request with id ${request.id} was calculated with finalisation in past (finalizationIn=${ms}, type=${currentType}). Fallback to first calculated finalization timestamp from DB.`,
      );
      // fallback to DB saved first calculation
      const wrInfo = await this.withdrawalRequestInfoEntityRepository.findOne({
        where: { requestId: request.id.toNumber() },
      });
      finalizationIn = wrInfo.firstCalculatedFinalizationTimestamp.getTime() - Date.now();
      currentType = wrInfo.firstCalculatedFinalizationType;
    }

    const isInPastFallback = requestTimestamp + finalizationIn - Date.now() < 0;
    // temporary fallback for negative results, can be deleted after validator balances computation improvements
    if (isInPastFallback) {
      this.logger.warn(
        `Request with id ${request.id} was taken from DB and finalisation still in past (recalculated finalizationIn=${ms}). Fallback to next frame`,
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
    const queueInfoLastUpdate = this.queueInfo.getLastUpdate();
    const contractConfigLastUpdate = this.contractConfig.getLastUpdate();

    const isInitialized = validatorsLastUpdate && queueInfoLastUpdate && requests && contractConfigLastUpdate;

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

  public calculateFrameByRewardsOnly(unfinalized: BigNumber) {
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    const rewardsPerFrame = this.rewardsStorage.getRewardsPerFrame();
    if (rewardsPerFrame.eq(0)) return null;

    const rewardsPerEpoch = rewardsPerFrame.div(epochPerFrame);
    const onlyRewardPotentialEpoch = unfinalized.div(rewardsPerEpoch);

    return (
      this.genesisTimeService.getFrameOfEpoch(
        this.genesisTimeService.getCurrentEpoch() + onlyRewardPotentialEpoch.toNumber(),
      ) + 1
    );
  }

  public async getFrameIsBunker(): Promise<null | number> {
    const isBunker = await this.contractWithdrawal.isBunkerModeActive();
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
    const totalValidators = this.validators.getActiveValidatorsCount();

    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);

    const lidoQueueInEpoch = unfinalizedETH.div(MIN_ACTIVATION_BALANCE.mul(Math.floor(churnLimit)));
    const sweepingMean = this.validators.getSweepMeanEpochs();
    const potentialExitEpoch = BigNumber.from(maxExitEpoch).add(lidoQueueInEpoch).add(sweepingMean);

    const waitingTime = potentialExitEpoch
      .sub(currentEpoch)
      .mul(SECONDS_PER_SLOT)
      .mul(SLOTS_PER_EPOCH)
      .div(60 * 60 * 24);

    return Math.round(waitingTime.toNumber());
  }

  // returns max exit epoch of validators with fallback to current epoch if max exit epoch already passed
  public getMaxExitEpoch() {
    const maxExitEpoch = this.validators.getMaxExitEpoch();
    const currentEpoch = this.genesisTimeService.getCurrentEpoch();

    return Math.max(+maxExitEpoch, currentEpoch + MAX_SEED_LOOKAHEAD + 1);
  }

  // returns block of processing ref slot or latest block depending on if report submit or processing
  async getLatestOrBlockProcessingRefSlot() {
    const address = await this.lidoLocator.accountingOracle();
    const accountingOracle = OracleV2__factory.connect(address, {
      provider: this.provider as any,
    });

    const processingState = await accountingOracle.getProcessingState();
    const currentFrameRefSlot = Number(processingState.currentFrameRefSlot);

    const block = await this.provider.getBlock('latest');

    if (processingState.dataSubmitted) {
      this.logger.debug(`using latest block ${block.number}`);
      return block.number;
    } else {
      const blockNumber = await this.genesisTimeService.getBlockBySlot(currentFrameRefSlot);
      this.logger.debug(`using processing ref slot of block ${blockNumber}`);
      return blockNumber;
    }
  }
}
