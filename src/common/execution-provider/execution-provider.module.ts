import { Global, Module } from '@nestjs/common';
import { FallbackProviderModule } from '@lido-nestjs/execution';
import { NonEmptyArray } from '@lido-nestjs/execution/dist/interfaces/non-empty-array';
import { ConnectionInfo } from '@ethersproject/web';
import { PrometheusService } from 'common/prometheus';
import { RPC_NETWORK_NAME } from 'common/prometheus/prometheus.constants';
import { normalizeRpcProvider, toResponseCodeClass } from 'common/prometheus/rpc-metrics.util';
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
        const chainId = String(network);

        return {
          urls,
          network,
          fetchMiddlewares: [
            async (next, ctx) => {
              const endTimer = prometheusService.elRpcRequestDuration.startTimer();
              const startedAt = Date.now();
              const provider = normalizeRpcProvider(ctx?.domain ?? '');
              const rpcLabels = { network: RPC_NETWORK_NAME, layer: 'el', chain_id: chainId, provider };

              try {
                const result = await next();
                endTimer({ result: 'success' });

                // `http_rpc_batch_size` / `http_rpc_request_payload_bytes` are observed
                // separately in ExecutionProviderService via the provider's `rpc` events,
                // which see the outgoing JSON-RPC batch before fetchMiddlewares ever runs.
                const batchSize = Array.isArray(result) ? result.length : 1;
                prometheusService.httpRpcResponsePayloadBytes.observe(
                  rpcLabels,
                  Buffer.byteLength(JSON.stringify(result)),
                );
                prometheusService.httpRpcResponseSeconds.observe(rpcLabels, (Date.now() - startedAt) / 1000);
                prometheusService.httpRpcRequestsTotal.inc({
                  ...rpcLabels,
                  batched: String(batchSize > 1),
                  response_code: '2xx',
                  result: 'success',
                });

                return result;
              } catch (error) {
                endTimer({ result: 'error' });
                prometheusService.httpRpcResponseSeconds.observe(rpcLabels, (Date.now() - startedAt) / 1000);
                prometheusService.httpRpcRequestsTotal.inc({
                  ...rpcLabels,
                  batched: 'unknown',
                  response_code: toResponseCodeClass((error as { status?: number })?.status),
                  result: 'fail',
                });
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
