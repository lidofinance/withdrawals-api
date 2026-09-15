import { FallbackProviderEvents, SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { CHAINS } from '@lido-nestjs/constants';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../prometheus';
import { RPC_NETWORK_NAME } from '../prometheus/prometheus.constants';
import { extractRpcErrorCode, normalizeRpcProvider } from '../prometheus/rpc-metrics.util';
import { Filter, Log } from '@ethersproject/abstract-provider';
import { LoggerService } from '@lido-nestjs/logger';
import { LOGGER_PROVIDER } from '../logger';

@Injectable()
export class ExecutionProviderService {
  constructor(
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly prometheusService: PrometheusService,
    protected readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
  ) {
    this.instrumentRpcRequests();
    this.instrumentBatchMetrics();
  }

  /**
   * `rpc_request_total` needs the JSON-RPC method name, which fetchMiddlewares never sees
   * (it only fires after ethers has already batched calls together). `perform()` is the one
   * choke point every ethers call (getBlock, getLogs, call, ...) goes through before batching,
   * so it's wrapped here instead of via a middleware.
   */
  private instrumentRpcRequests(): void {
    const originalPerform = this.provider.perform.bind(this.provider);
    const chainId = String(this.configService.get('CHAIN_ID'));

    this.provider.perform = async (method: string, params: { [name: string]: unknown }) => {
      try {
        const result = await originalPerform(method, params);
        this.observeRpcRequest(method, chainId, 'success', '');
        return result;
      } catch (error) {
        this.observeRpcRequest(method, chainId, 'fail', extractRpcErrorCode(error));
        throw error;
      }
    };
  }

  // Recording the metric is deliberately outside the try/catch that determines the RPC
  // call's own outcome: a bug here must never mask or replace the real result/error.
  private observeRpcRequest(method: string, chainId: string, result: 'success' | 'fail', rpcErrorCode: string): void {
    try {
      this.prometheusService.rpcRequestTotal.inc({
        network: RPC_NETWORK_NAME,
        layer: 'el',
        chain_id: chainId,
        provider: this.getActiveProviderDomain(),
        method,
        result,
        rpc_error_code: rpcErrorCode,
      });
    } catch (error) {
      this.logger.error('Failed to observe rpc_request_total', { error });
    }
  }

  // `provider` (the active fallback connection) is `protected` on the library class; it's
  // only informational, so read it through a cast rather than skipping the label entirely.
  // Two hops: `this.provider.provider` is the `{provider, network, index, unreachable}`
  // wrapper, and `.provider` on *that* is the actual ExtendedJsonRpcBatchProvider with `.domain`.
  private getActiveProviderDomain(): string {
    const fallback = (this.provider as unknown as { provider: { provider: { domain: string } } }).provider;
    return normalizeRpcProvider(fallback.provider.domain);
  }

  /**
   * `http_rpc_batch_size` / `http_rpc_request_payload_bytes` need the outgoing JSON-RPC batch
   * body, which fetchMiddlewares never sees (it only wraps the HTTP call itself). The library
   * publicly emits it via `eventEmitter` right before that HTTP call is made, so no transport
   * patch or library upgrade is needed to close this gap.
   */
  private instrumentBatchMetrics(): void {
    const chainId = String(this.configService.get('CHAIN_ID'));

    this.provider.eventEmitter.on('rpc', (event: FallbackProviderEvents) => {
      if (event.action !== 'provider:request-batched') return;

      try {
        const rpcLabels = {
          network: RPC_NETWORK_NAME,
          layer: 'el',
          chain_id: chainId,
          provider: normalizeRpcProvider(event.domain),
        };
        this.prometheusService.httpRpcBatchSize.observe(rpcLabels, event.request.length);
        this.prometheusService.httpRpcRequestPayloadBytes.observe(
          rpcLabels,
          Buffer.byteLength(JSON.stringify(event.request)),
        );
      } catch (error) {
        // Never let metrics bookkeeping break the batch aggregator: `emit()` calls
        // listeners synchronously, so a throw here would propagate into ethers' internals.
        this.logger.error('Failed to observe EL batch metrics', { error });
      }
    });
  }

  /**
   * Returns network name
   */
  public async getNetworkName(): Promise<string> {
    const network = await this.provider.getNetwork();
    const name = CHAINS[network.chainId]?.toLocaleLowerCase();
    return name || network.name;
  }

  /**
   * Returns current chain id
   */
  public async getChainId(): Promise<number> {
    const { chainId } = await this.provider.getNetwork();
    return chainId;
  }

  public async getLogsByBlockStepsWithRetry(
    filter: Filter,
    eventName: string,
    serviceName: string,
    retryCount: number = this.configService.get('EL_RETRY_COUNT'),
    blockStep: number = this.configService.get('EL_BLOCK_STEP'),
  ): Promise<Log[]> {
    let logs: Log[] = [];
    const toBlock =
      typeof filter.toBlock === 'number' ? filter.toBlock : (await this.provider.getBlock(filter.toBlock)).number;
    const fromBlock =
      typeof filter.fromBlock === 'number' ? filter.fromBlock : (await this.provider.getBlock(filter.fromBlock)).number;

    for (let startBlock = fromBlock; startBlock <= toBlock; startBlock += blockStep) {
      const endBlock = Math.min(startBlock + blockStep - 1, toBlock);

      const blockFilter = { ...filter, fromBlock: startBlock, toBlock: endBlock };

      let attempt = 0;
      let blockLogs: Log[] = [];

      while (blockLogs.length === 0 && attempt < retryCount) {
        try {
          blockLogs = await this.provider.getLogs(blockFilter);
        } catch (error) {
          this.logger.error(`${eventName}: Error fetching logs for blocks ${startBlock} - ${endBlock}: ${error}`, {
            service: serviceName,
          });
        }

        if (blockLogs.length === 0) {
          this.logger.debug(
            `${eventName}: No logs found for blocks ${startBlock} - ${endBlock}. Retrying in 200 ms...`,
            {
              service: serviceName,
            },
          );
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        attempt += 1;
      }

      logs = logs.concat(blockLogs);
    }

    return logs;
  }
}
