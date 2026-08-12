import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { Inject, Injectable } from '@nestjs/common';
import { processJsonStreamBeaconState } from './utils/process-json-stream-beacon-state';
import { BeaconStateSweepData, PendingPartialWithdrawal } from './consensus-provider.types';
import {
  API_GET_EXECUTION_PAYLOAD_ENVELOPE_URL,
  API_GET_PENDING_PARTIAL_WITHDRAWALS_URL,
  API_GET_STATE_URL,
} from './consensus-provider.constants';
import { ExecutionPayloadEnvelopeResponse } from './types/execution-payload-envelope-response';
import { ExecutionPayload } from './types/execution-payload';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';

const GET_STATE_SWEEP_DATA_MAX_ATTEMPTS = 3;
const GET_STATE_SWEEP_DATA_RETRY_DELAY_MS = 10_000;

@Injectable()
export class ConsensusClientService {
  private stateSweepRequestCount = 0;

  constructor(
    protected readonly consensusService: ConsensusProviderService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
  ) {}

  public async getExecutionPayloadEnvelope(blockId: string): Promise<ExecutionPayload> {
    const result = await this.consensusService.fetch<ExecutionPayloadEnvelopeResponse>(
      API_GET_EXECUTION_PAYLOAD_ENVELOPE_URL(blockId),
    );

    return result.data.message.payload;
  }

  public async getStateSweepData(stateId: string): Promise<BeaconStateSweepData> {
    const requestId = ++this.stateSweepRequestCount;

    for (let attempt = 1; attempt <= GET_STATE_SWEEP_DATA_MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now();

      this.logger.debug('[getStateSweepData] attempt started', {
        requestId,
        stateId,
        attempt,
        maxAttempts: GET_STATE_SWEEP_DATA_MAX_ATTEMPTS,
      });

      try {
        const stream = await this.consensusService.fetchStream(API_GET_STATE_URL(stateId));
        const result = await processJsonStreamBeaconState(stream, [
          'slot',
          'next_withdrawal_validator_index',
          'latest_full_slot',
          'latest_withdrawals_root',
        ]);

        this.logger.log('[getStateSweepData] attempt completed', {
          requestId,
          stateId,
          attempt,
          maxAttempts: GET_STATE_SWEEP_DATA_MAX_ATTEMPTS,
          durationMs: Date.now() - startedAt,
        });

        return result as BeaconStateSweepData;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.logger.warn('[getStateSweepData] attempt failed', {
          requestId,
          stateId,
          attempt,
          maxAttempts: GET_STATE_SWEEP_DATA_MAX_ATTEMPTS,
          durationMs,
          error: errorMessage,
        });

        if (attempt === GET_STATE_SWEEP_DATA_MAX_ATTEMPTS) {
          throw error;
        }

        const retryDelayMs = GET_STATE_SWEEP_DATA_RETRY_DELAY_MS * attempt;

        this.logger.warn('[getStateSweepData] retrying', {
          requestId,
          stateId,
          nextAttempt: attempt + 1,
          retryDelayMs,
        });

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    throw new Error(`Failed to get consensus state ${stateId}`);
  }

  public async getPendingPartialWithdrawals(stateId: string): Promise<PendingPartialWithdrawal[]> {
    const result = await this.consensusService.fetch<{
      data?: PendingPartialWithdrawal[];
    }>(API_GET_PENDING_PARTIAL_WITHDRAWALS_URL(stateId));

    return result.data ?? [];
  }
}
