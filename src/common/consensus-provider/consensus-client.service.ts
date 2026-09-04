import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { BigNumber } from '@ethersproject/bignumber';
import { Injectable } from '@nestjs/common';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { processJsonStreamBeaconState } from './utils/process-json-stream-beacon-state';
import { BeaconStateSweepData, IndexedBuilder, PendingPartialWithdrawal } from './consensus-provider.types';
import {
  API_GET_EXECUTION_PAYLOAD_ENVELOPE_URL,
  API_GET_PENDING_PARTIAL_WITHDRAWALS_URL,
  API_GET_STATE_BUILDERS_URL,
  API_GET_STATE_URL,
} from './consensus-provider.constants';
import { ExecutionPayloadEnvelopeResponse } from './types/execution-payload-envelope-response';
import { ExecutionPayload } from './types/execution-payload';
import { ConsensusRetryService } from './consensus-retry.service';

@Injectable()
export class ConsensusClientService {
  constructor(
    protected readonly consensusService: ConsensusProviderService,
    protected readonly consensusRetryService: ConsensusRetryService,
  ) {}

  public async getExecutionPayloadEnvelope(blockId: string): Promise<ExecutionPayload> {
    const result = await this.consensusService.fetch<ExecutionPayloadEnvelopeResponse>(
      API_GET_EXECUTION_PAYLOAD_ENVELOPE_URL(blockId),
    );

    return result.data.message.payload;
  }

  public async getStateSweepData(
    stateId: string,
    currentEpoch: number,
    isGlamsterdam: boolean,
  ): Promise<BeaconStateSweepData> {
    return this.consensusRetryService.execute('get_state_sweep_data', async () => {
      const stream = await this.consensusService.fetchStream(API_GET_STATE_URL(stateId));
      const result = await processJsonStreamBeaconState(stream);

      const builder_pending_withdrawals_count = result.builder_pending_withdrawals?.length ?? 0;
      const exited_builder_withdrawals_count = isGlamsterdam
        ? await this.getExitedBuilderWithdrawalsCount(stateId, currentEpoch)
        : 0;

      delete result.builder_pending_withdrawals;

      return {
        ...result,
        builder_pending_withdrawals_count,
        exited_builder_withdrawals_count,
      };
    });
  }

  /**
   * The builders endpoint provides the builder registry without retaining it in
   * the much larger debug beacon-state object. Count matching builders as they stream.
   */
  private async getExitedBuilderWithdrawalsCount(stateId: string, currentEpoch: number): Promise<number> {
    const buildersStream = await this.consensusService.fetchStream(API_GET_STATE_BUILDERS_URL(stateId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const pipeline = chain([buildersStream as any, parser(), pick({ filter: 'data' }), streamArray()]);
    let count = 0;

    try {
      for await (const { value } of pipeline) {
        const builder = (value as IndexedBuilder).builder;
        if (BigNumber.from(builder.balance).gt(0) && BigNumber.from(builder.withdrawable_epoch).lte(currentEpoch)) {
          count++;
        }
      }
      return count;
    } finally {
      pipeline.destroy();
      pipeline.streams.forEach((stream) => stream.destroy());
    }
  }

  public async getPendingPartialWithdrawals(stateId: string): Promise<PendingPartialWithdrawal[]> {
    const result = await this.consensusService.fetch<{
      data?: PendingPartialWithdrawal[];
    }>(API_GET_PENDING_PARTIAL_WITHDRAWALS_URL(stateId));

    return result.data ?? [];
  }
}
