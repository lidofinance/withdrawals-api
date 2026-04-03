import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { Injectable } from '@nestjs/common';
import { SpecService } from 'common/spec/spec.service';
import { ConsensusClientService } from './consensus-client.service';
import { ResponseBlockV2 } from './consensus-provider.types';
import { ExecutionPayload } from './types/execution-payload';

@Injectable()
export class ConsensusExecutionPayloadService {
  constructor(
    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly consensusClientService: ConsensusClientService,
    protected readonly specService: SpecService,
  ) {}

  public async getExecutionPayload(blockId: string): Promise<ExecutionPayload> {
    const clBlock = await this.consensusProviderService.getBlockV2({ blockId });
    const clSlot = Number(clBlock.data.message.slot);

    if (this.specService.isGlamsterdamReleasedAtSlot(clSlot)) {
      return this.consensusClientService.getExecutionPayloadEnvelope(blockId);
    }

    return this.getLegacyExecutionPayload(clBlock);
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
