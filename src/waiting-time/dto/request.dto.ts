import { WithdrawalRequest } from 'storage';

export class RequestDto {
  id: string;
  amountOfStETH: string;
  amountOfShares: string;
  timestamp: string;
}

export const transformToRequestDto = (request: WithdrawalRequest): RequestDto => {
  return {
    id: request.id.toString(),
    amountOfStETH: request.amountOfStETH.toString(),
    amountOfShares: request.amountOfStETH.toString(),
    timestamp: new Date(request.timestamp.toNumber() * 1000).toISOString(),
  };
};
