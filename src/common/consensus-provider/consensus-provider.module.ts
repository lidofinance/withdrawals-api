import { ConsensusModule } from '@lido-nestjs/consensus';
import { Global, Module } from '@nestjs/common';
import { CONSENSUS_POOL_INTERVAL_MS } from './consensus-provider.constants';
import { ConsensusFetchModule } from './consensus-fetch.module';
import { ConsensusClientService } from './consensus-client.service';
import { ConsensusExecutionPayloadService } from './consensus-execution-payload.service';
import { ConsensusRetryService } from './consensus-retry.service';
import { LoggerModule } from 'common/logger';
import { ConfigModule } from 'common/config';
import { PrometheusModule } from 'common/prometheus';

@Global()
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrometheusModule,
    ConsensusModule.forRoot({
      imports: [ConsensusFetchModule],
      pollingInterval: CONSENSUS_POOL_INTERVAL_MS,
    }),
  ],
  exports: [ConsensusModule, ConsensusClientService, ConsensusExecutionPayloadService, ConsensusRetryService],
  providers: [ConsensusClientService, ConsensusExecutionPayloadService, ConsensusRetryService],
})
export class ConsensusProviderModule {}
