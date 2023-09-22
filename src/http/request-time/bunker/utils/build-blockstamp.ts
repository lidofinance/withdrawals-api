import { ConsensusMethodResult } from '@lido-nestjs/consensus';
import { BlockStamp, ReferenceBlockStamp } from '../bunker.types';
import { BigNumber } from '@ethersproject/bignumber';

type BlockDetails = Awaited<ConsensusMethodResult<'getBlockV2'>>['data'];

export const buildBlockstamp = (blockDetails: BlockDetails): BlockStamp => {
  // todo PR into @lido-nestjs/consensus, add typings to getBlockV2
  const executionData = (blockDetails.message.body as any).execution_payload;
  return {
    stateRoot: blockDetails.message.state_root,
    slot_number: Number(blockDetails.message.slot),
    block_number: executionData['block_number'],
    block_hash: executionData['block_hash'],
    block_timestamp: executionData['timestamp'],
  };
};
export const buildReferenceBlockstamp = (
  blockDetails: BlockDetails,
  refSlot: BigNumber,
  refEpoch: BigNumber,
): ReferenceBlockStamp => {
  return {
    ...buildBlockstamp(blockDetails),
    ref_slot: refSlot,
    ref_epoch: refEpoch,
  };
};
