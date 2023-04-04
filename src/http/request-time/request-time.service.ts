import { Injectable } from '@nestjs/common';
import { ValidatorsStorageService, QueueInfoStorageService } from 'storage';
import { BigNumber } from '@ethersproject/bignumber';
import { ConfigService } from 'common/config';

import {
  MIN_PER_EPOCH_CHURN_LIMIT,
  CHURN_LIMIT_QUOTIENT,
  GENESIS_TIME_BY_CHAIN,
  SECONDS_IN_SLOT,
  SLOTS_IN_EPOCH,
  MAX_SEED_LOOKAHEAD,
  FAR_FUTURE_EPOCH,
  MAX_EFFECTIVE_BALANCE,
  MAX_WITHDRAWALS_PER_PAYLOAD,
} from './request-time.constants';
import { RequestTimeDto, RequestTimeOptionsDto } from './dto';
import { parseEther } from '@ethersproject/units';

@Injectable()
export class RequestTimeService {
  constructor(
    protected readonly validators: ValidatorsStorageService,
    protected readonly queueInfo: QueueInfoStorageService,
    protected readonly configService: ConfigService,
  ) {}

  async getRequestTime({ amount }: RequestTimeOptionsDto): Promise<RequestTimeDto> {
    const validators = this.validators.get();
    if (!validators?.length) return null;

    const unfinalizedETH = this.queueInfo.getStETH();
    if (!unfinalizedETH) return null;

    const additionalStETH = parseEther(amount || '0');
    const queueStETH = unfinalizedETH.add(additionalStETH);

    const validatorsLastUpdate = this.validators.getLastUpdate();
    const stethLastUpdate = this.queueInfo.getLastUpdate();
    const days = this.calculateRequestTime(queueStETH, validators);
    const requestsCount = this.queueInfo.getRequests();

    return {
      days,
      stethLastUpdate,
      validatorsLastUpdate,
      steth: unfinalizedETH.toString(),
      requests: requestsCount.toNumber(),
    };
  }

  calculateRequestTime(unfinalizedETH: BigNumber, validators: any[]): number {
    const chainId = this.configService.get('CHAIN_ID');
    const totalValidators = validators.length;

    const churnLimit = Math.max(MIN_PER_EPOCH_CHURN_LIMIT, totalValidators / CHURN_LIMIT_QUOTIENT);

    const genesisTime = GENESIS_TIME_BY_CHAIN[chainId] || 0;
    const CURRENT_TIME = Math.floor(new Date().getTime() / 1000);
    const currentEpoch = Math.floor((CURRENT_TIME - genesisTime) / SECONDS_IN_SLOT / SLOTS_IN_EPOCH);

    const validatorsExitEpochs = validators.map((v) => v.validator.exit_epoch);
    validatorsExitEpochs.push(`${currentEpoch + MAX_SEED_LOOKAHEAD + 1}`);

    const latestEpoch = validatorsExitEpochs.reduce((acc, v) => {
      if (v !== FAR_FUTURE_EPOCH.toString()) {
        if (BigNumber.from(v).gt(BigNumber.from(acc))) {
          return v;
        }
      }
      return acc;
    }, '0');

    const lidoQueueInEpoch = unfinalizedETH.div(MAX_EFFECTIVE_BALANCE.mul(Math.floor(churnLimit)));
    const sweepingMean = BigNumber.from(totalValidators)
      .div(BigNumber.from(MAX_WITHDRAWALS_PER_PAYLOAD).mul(SLOTS_IN_EPOCH))
      .div(2);
    const potentialExitEpoch = BigNumber.from(latestEpoch).add(lidoQueueInEpoch).add(sweepingMean);

    const waitingTime = potentialExitEpoch
      .sub(currentEpoch)
      .mul(SECONDS_IN_SLOT)
      .mul(SLOTS_IN_EPOCH)
      .div(60 * 60 * 24);

    return Math.round(waitingTime.toNumber());
  }
}
