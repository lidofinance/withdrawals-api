import { BigNumber } from '@ethersproject/bignumber';
import { WithdrawalRequest } from 'storage';

export const calculateUnfinalizedEthToRequestId = (requests: WithdrawalRequest[], request: WithdrawalRequest) => {
  let unfinalizedETH = BigNumber.from(0);
  for (const r of requests) {
    unfinalizedETH = unfinalizedETH.add(r.amountOfStETH);

    if (r.id.eq(request.id)) break;
  }

  return unfinalizedETH;
};
