import { BigNumber } from '@ethersproject/bignumber';

import { WithdrawalRequest } from 'storage';
import { WaitingTimeCalculationType } from './entities/withdrawal-time-calculation-type.enum';

export enum WaitingTimeStatus {
  initializing = 'initializing',
  calculating = 'calculating',
  finalized = 'finalized',
  calculated = 'calculated',
}

export type GetWaitingTimeInfoV2Args = {
  amount: string;
  cached?: {
    unfinalized: BigNumber;
    buffer: BigNumber;
    vaultsBalance: BigNumber;
  };
};

export type GetWaitingTimeInfoV2Result = {
  requestInfo: CalculateTimeByIdRequestInfo | null; // Request info
  status: WaitingTimeStatus; // Status of request calculation
  nextCalculationAt: string; // Next calculation time at
};

export type GetWaitingTimeInfoByIdArgs = {
  requestId: string;
  unfinalized: BigNumber;
  buffer: BigNumber;
  vaultsBalance: BigNumber;
};

export type GetWaitingTimeInfoByIdResult = {
  requestInfo: CalculateTimeByIdRequestInfo; // Request info
  status: WaitingTimeStatus; // Status of request calculation
  nextCalculationAt: string; // Next calculation time at
};

export type CalculateTimeByIdRequestInfo = {
  finalizationIn: number; // Possible waiting ms
  finalizationAt: string; // Possible finalization At
  requestId?: string; // Request Id
  requestedAt?: string; // Withdrawal requested at
  type: WaitingTimeCalculationType; // Case of calculation
};

export type CheckInPastCaseArgs = {
  request: WithdrawalRequest;
  vaultsBalance: BigNumber;
  buffer: BigNumber;
  frame: number;
  type: WaitingTimeCalculationType;
};

export type CalculateWaitingTimeV2Args = {
  unfinalized: BigNumber; // including withdrawal eth
  buffer: BigNumber;
  vaultsBalance: BigNumber;
  requestTimestamp: number;
  latestEpoch: string;
};

export type CalculateWaitingTimeV2Result = {
  type: WaitingTimeCalculationType;
  frame: number;
};
