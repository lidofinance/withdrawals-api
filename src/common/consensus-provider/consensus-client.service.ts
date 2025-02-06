import { ConsensusProviderService } from './index';
import { Injectable } from '@nestjs/common';
import { processJsonStreamBeaconState } from './utils/process-json-stream-beacon-state';
import { BeaconState } from './consensus-provider.types';

@Injectable()
export class ConsensusClientService {
  private API_GET_STATE = (stateId: string) => `/eth/v2/debug/beacon/states/${stateId}`;
  constructor(protected readonly consensusService: ConsensusProviderService) {}

  public async isElectraActivated(epoch: number) {
    const spec = await this.consensusService.getSpec();
    return epoch >= +spec.data.ELECTRA_FORK_EPOCH;
  }

  public async getStateStream(stateId: string): Promise<BeaconState> {
    const stream = await this.consensusService.fetchStream(this.API_GET_STATE(stateId));
    const result = await processJsonStreamBeaconState(stream);
    return result as BeaconState;
  }
}
