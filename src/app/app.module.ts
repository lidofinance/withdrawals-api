import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { PrometheusModule } from 'common/prometheus';
import { ConfigModule } from 'common/config';
import { SentryInterceptor } from 'common/sentry';
import { HealthModule } from 'common/health';
import { JobsModule } from 'jobs';
import { ConsensusProviderModule } from 'common/consensus-provider';
import { ExecutionProviderModule } from 'common/execution-provider';
import { ContractsModule } from 'common/contracts';
import { AppService } from './app.service';
import { HTTPModule } from '../http';

@Module({
  imports: [
    ConsensusProviderModule,
    ExecutionProviderModule,
    HTTPModule,
    HealthModule,
    PrometheusModule,
    ConfigModule,
    JobsModule,
    ContractsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: SentryInterceptor }, AppService],
})
export class AppModule {}
