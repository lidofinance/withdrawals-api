import { ConsensusMethodResult } from '@lido-nestjs/consensus/dist/interfaces/consensus.interface';

export type ResponseValidatorsData = Awaited<ConsensusMethodResult<'getStateValidators'>>['data'];
export type IndexedValidator = ResponseValidatorsData[number];
export type Validator = ResponseValidatorsData[number]['validator'];

/**
 * Spec reference:
 * https://github.com/ethereum/consensus-specs/blob/dev/specs/electra/beacon-chain.md#pendingpartialwithdrawal
 */
export interface PendingPartialWithdrawal {
  validator_index: string;
  amount: string;
  withdrawable_epoch: string;
}

/**
 * Spec reference:
 * https://github.com/ethereum/consensus-specs/blob/dev/specs/electra/beacon-chain.md#beaconstate
 * included only used properties
 */
export interface BeaconState {
  slot: string;
  pending_partial_withdrawals: PendingPartialWithdrawal[];
  validators: Validator[];
  balances: string[];
}
