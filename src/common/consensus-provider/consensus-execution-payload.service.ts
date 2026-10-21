import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SpecService } from 'common/spec/spec.service';
import { ResponseBlockV2 } from './consensus-provider.types';
import { ExecutionPayload } from './types/execution-payload';

type GloasBlockBody = {
  signed_execution_payload_bid?: { message?: { parent_block_hash?: string } };
};

@Injectable()
export class ConsensusExecutionPayloadService {
  constructor(
    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly specService: SpecService,
  ) {}

  /**
   * Hash of the EL block whose state the accounting oracle reports for `refSlot`.
   *
   * Pre-Gloas the ref slot block embeds that payload. Post-Gloas (EIP-7732) a slot's payload is
   * applied only when a later block builds on it, so the oracle anchors to the first block after
   * the ref slot and takes the EL parent committed in its bid. A withheld or late ref slot payload
   * therefore keeps the anchor on the previous EL block, which this mirrors.
   */
  public async getReportAnchorBlockHash(refSlot: number, headSlot: number): Promise<string> {
    if (!this.specService.isGlamsterdamReleasedAtSlot(refSlot)) {
      const refBlock = await this.consensusProviderService.getBlockV2({ blockId: String(refSlot) });
      return this.getLegacyExecutionPayload(refBlock).block_hash;
    }

    const childBlock = await this.getFirstBlockAfter(refSlot, headSlot);
    const body = childBlock.data?.message?.body as GloasBlockBody | undefined;
    const parentBlockHash = body?.signed_execution_payload_bid?.message?.parent_block_hash;

    if (!parentBlockHash) {
      throw new Error(`Block at slot ${childBlock.data?.message?.slot} has no execution payload bid`);
    }

    return parentBlockHash;
  }

  private async getFirstBlockAfter(slot: number, headSlot: number): Promise<ResponseBlockV2> {
    for (let candidate = slot + 1; candidate <= headSlot; candidate++) {
      try {
        return await this.consensusProviderService.getBlockV2({ blockId: String(candidate) });
      } catch (error) {
        const isMissedSlot = error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND;
        if (!isMissedSlot) throw error;
      }
    }

    throw new Error(`No block after slot ${slot} up to slot ${headSlot}`);
  }

  private getLegacyExecutionPayload(block: ResponseBlockV2): ExecutionPayload {
    const body = block.data?.message?.body;
    const executionPayload =
      body && 'execution_payload' in body ? (body.execution_payload as ExecutionPayload | undefined) : undefined;
    const clSlot = Number(block.data?.message?.slot);

    if (!executionPayload) {
      throw new Error(`Failed to get execution payload for block with slot ${clSlot}`);
    }

    return executionPayload;
  }
}
