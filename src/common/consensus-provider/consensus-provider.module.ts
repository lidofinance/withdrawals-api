import { ConsensusModule } from '@lido-nestjs/consensus';
import { Global, Module } from '@nestjs/common';
import { CONSENSUS_POOL_INTERVAL_MS } from './consensus-provider.constants';
import { ConsensusFetchModule } from './consensus-fetch.module';
import { ConsensusClientService } from './consensus-client.service';

@Global()
@Module({
  imports: [
    ConsensusModule.forRoot({
      imports: [ConsensusFetchModule],
      pollingInterval: CONSENSUS_POOL_INTERVAL_MS,
    }),
  ],
  exports: [ConsensusClientService],
  providers: [ConsensusClientService],
})
export class ConsensusProviderModule {}
