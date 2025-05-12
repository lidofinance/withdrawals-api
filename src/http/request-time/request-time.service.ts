import { Inject, Injectable, LoggerService } from '@nestjs/common';

import { BigNumber } from '@ethersproject/bignumber';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { parseEther } from '@ethersproject/units';

import { QueueInfoStorageService, ValidatorsStorageService } from 'storage';
import { WaitingTimeService, WaitingTimeStatus } from 'waiting-time';

import { RequestTimeDto, RequestTimeOptionsDto } from './dto';
import { RequestTimeV2Dto } from './dto/request-time-v2.dto';
import { RequestsTimeOptionsDto } from './dto/requests-time-options.dto';

@Injectable()
export class RequestTimeService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly waitingTimeService: WaitingTimeService,
    protected readonly validators: ValidatorsStorageService,
    protected readonly queueInfo: QueueInfoStorageService,
  ) {}

  async getRequestTime(params: RequestTimeOptionsDto): Promise<RequestTimeDto | null> {
    const isInitializing = this.waitingTimeService.checkIsInitializing();
    if (!isInitializing) {
      return {
        status: WaitingTimeStatus.initializing,
      };
    }

    const validatorsLastUpdate = this.validators.getLastUpdate();
    const unfinalizedETH = this.queueInfo.getStETH();
    const additionalStETH = parseEther(params.amount || '0');
    const queueStETH = unfinalizedETH.add(additionalStETH);

    const stethLastUpdate = this.queueInfo.getLastUpdate();
    let days = this.waitingTimeService.calculateRequestTimeSimple(queueStETH);

    const requestsCount = this.queueInfo.getUnfinalizedRequestsCount();

    if (days <= 0) {
      this.logger.error('Error: withdrawal time calculation less 0 days');
      days = 5;
    }

    return {
      days,
      stethLastUpdate,
      validatorsLastUpdate,
      steth: unfinalizedETH.toString(),
      requests: requestsCount.toNumber(),
      status: WaitingTimeStatus.calculated,
    };
  }

  async getRequestTimeV2({
    amount,
    cached,
  }: {
    amount: string;
    cached?: {
      unfinalized: BigNumber;
      buffer: BigNumber;
      vaultsBalance: BigNumber;
    };
  }): Promise<RequestTimeV2Dto | null> {
    return await this.waitingTimeService.getWaitingTimeInfo({ amount, cached });
  }

  async getTimeRequests(requestOptions: RequestsTimeOptionsDto) {
    return await this.waitingTimeService.calculateRequestsTime(requestOptions.ids);
  }
}
