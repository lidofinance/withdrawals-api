import { ConsensusMethodResult } from '@lido-nestjs/consensus/dist/interfaces/consensus.interface';

export type ResponseBlockV2 = Awaited<ConsensusMethodResult<'getBlockV2'>>;
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

export interface BeaconStateSweepData {
  slot: string;
  next_withdrawal_validator_index?: string;
  // Gloas (EIP-7732) only — absent on pre-fork states
  builder_pending_withdrawals_count: number;
  exited_builder_withdrawals_count: number;
  execution_payload_availability?: string;
}

export interface Builder {
  balance: string;
  withdrawable_epoch: string;
}

export interface IndexedBuilder {
  index: string;
  status: string;
  builder: Builder;
}

/**
 * Spec reference:
 * https://github.com/ethereum/consensus-specs/blob/dev/specs/electra/beacon-chain.md#beaconstate
 * included only used properties
 */
export interface BeaconState {
  slot: string;
  next_withdrawal_validator_index?: string;
  builder_pending_withdrawals?: unknown[];
  execution_payload_availability?: string;
  pending_partial_withdrawals: PendingPartialWithdrawal[];
  validators: Validator[];
  balances: string[];
}
