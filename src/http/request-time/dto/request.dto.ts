import { WithdrawalRequest } from '../../../storage/queue-info/queue-info.types';

export class RequestDto {
  id: string;
  amountOfStETH: string;
  amountOfShares: string;
  timestamp: string;
  isFinalized: boolean;
  isClaimed: boolean;
}

export const transformToRequestDto = (request: WithdrawalRequest): RequestDto => {
  return {
    id: request.id.toString(),
    amountOfStETH: request.amountOfStETH.toString(),
    amountOfShares: request.amountOfStETH.toString(),
    timestamp: new Date(request.timestamp.toNumber() * 1000).toISOString(),
    isFinalized: request.isFinalized,
    isClaimed: request.isClaimed,
  };
};
