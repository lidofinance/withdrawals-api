import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { Injectable } from '@nestjs/common';
import { processJsonStreamBeaconState } from './utils/process-json-stream-beacon-state';
import { BeaconStateSweepData, PendingPartialWithdrawal } from './consensus-provider.types';
import {
  API_GET_EXECUTION_PAYLOAD_ENVELOPE_URL,
  API_GET_PENDING_PARTIAL_WITHDRAWALS_URL,
  API_GET_STATE_URL,
} from './consensus-provider.constants';
import { ExecutionPayloadEnvelopeResponse } from './types/execution-payload-envelope-response';
import { ExecutionPayload } from './types/execution-payload';

@Injectable()
export class ConsensusClientService {
  constructor(protected readonly consensusService: ConsensusProviderService) {}

  public async getExecutionPayloadEnvelope(blockId: string): Promise<ExecutionPayload> {
    const result = await this.consensusService.fetch<ExecutionPayloadEnvelopeResponse>(
      API_GET_EXECUTION_PAYLOAD_ENVELOPE_URL(blockId),
    );

    return result.data.message.payload;
  }

  public async getStateSweepData(stateId: string): Promise<BeaconStateSweepData> {
    const stream = await this.consensusService.fetchStream(API_GET_STATE_URL(stateId));
    const result = await processJsonStreamBeaconState(stream, [
      'slot',
      'next_withdrawal_validator_index',
      'latest_full_slot',
      'latest_withdrawals_root',
    ]);

    return result as BeaconStateSweepData;
  }

  public async getPendingPartialWithdrawals(stateId: string): Promise<PendingPartialWithdrawal[]> {
    const result = await this.consensusService.fetch<{
      data?: PendingPartialWithdrawal[];
    }>(API_GET_PENDING_PARTIAL_WITHDRAWALS_URL(stateId));

    return result.data ?? [];
  }
}
