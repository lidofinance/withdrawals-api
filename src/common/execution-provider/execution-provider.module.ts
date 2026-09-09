import { Global, Module } from '@nestjs/common';
import { FallbackProviderModule } from '@lido-nestjs/execution';
import { NonEmptyArray } from '@lido-nestjs/execution/dist/interfaces/non-empty-array';
import { ConnectionInfo } from '@ethersproject/web';
import { PrometheusService } from 'common/prometheus';
import { ConfigService } from 'common/config';
import { APP_USER_AGENT } from 'app/app.constants';
import { ExecutionProviderService } from './execution-provider.service';

@Global()
@Module({
  imports: [
    FallbackProviderModule.forRootAsync({
      async useFactory(configService: ConfigService, prometheusService: PrometheusService) {
        const rpcUrls = configService.get('EL_RPC_URLS') as NonEmptyArray<string>;
        const urls = rpcUrls.map((url) => ({
          url,
          headers: { 'User-Agent': APP_USER_AGENT },
        })) as unknown as NonEmptyArray<ConnectionInfo>;
        const network = configService.get('CHAIN_ID');

        return {
          urls,
          network,
          fetchMiddlewares: [
            async (next) => {
              const endTimer = prometheusService.elRpcRequestDuration.startTimer();

              try {
                const result = await next();
                endTimer({ result: 'success' });
                return result;
              } catch (error) {
                endTimer({ result: 'error' });
                throw error;
              }
            },
          ],
        };
      },
      inject: [ConfigService, PrometheusService],
    }),
  ],
  providers: [ExecutionProviderService],
  exports: [ExecutionProviderService],
})
export class ExecutionProviderModule {}
