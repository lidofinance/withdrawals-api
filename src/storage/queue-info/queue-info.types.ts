import { WithdrawalQueueBase } from '@lido-nestjs/contracts/dist/generated/WithdrawalQueue';
import { BigNumber } from '@ethersproject/bignumber';

export interface WithdrawalRequest extends WithdrawalQueueBase.WithdrawalRequestStatusStructOutput {
  id: BigNumber;
}
