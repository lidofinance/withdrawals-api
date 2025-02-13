import { ConsensusProviderService } from './index';
import { Injectable } from '@nestjs/common';
import { processJsonStreamBeaconState } from './utils/process-json-stream-beacon-state';
import { BeaconState } from './consensus-provider.types';
import { API_GET_STATE_URL } from './consensus-provider.constants';

@Injectable()
export class ConsensusClientService {
  constructor(protected readonly consensusService: ConsensusProviderService) {}

  public async isElectraActivated(epoch: number) {
    const spec = await this.consensusService.getSpec();
    return epoch >= +spec.data.ELECTRA_FORK_EPOCH;
  }

  public async getStateStream(stateId: string): Promise<BeaconState> {
    const stream = await this.consensusService.fetchStream(API_GET_STATE_URL(stateId));
    const result = await processJsonStreamBeaconState(stream);
    return result as BeaconState;
  }
}
