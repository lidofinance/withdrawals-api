import { BigNumber } from '@ethersproject/bignumber';

export type BlockStamp = {
  // todo rename props
  stateRoot: string;
  slot_number: number;
  block_hash: string;
  block_number: number;
  block_timestamp: BigNumber;
};

// Ref slot could differ from slot_number if ref_slot was missed slot_number will be previous first non-missed slot
export type ReferenceBlockStamp = BlockStamp & {
  // todo rename props
  ref_slot: BigNumber;
  ref_epoch: BigNumber;
};

export type LidoReportRebase = {
  post_total_pooled_ether: number;
  post_total_shares: number;
  withdrawals: BigNumber;
  el_reward: BigNumber;
};
