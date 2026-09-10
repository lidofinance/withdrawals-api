import { HttpException, Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from '@lido-nestjs/logger';
import { FetchModuleOptions, FetchService, RequestInfo } from '@lido-nestjs/fetch';
import { MiddlewareService } from '@lido-nestjs/middleware';
import { AbortController } from 'node-abort-controller';
import { Headers, RequestInit, Response } from 'node-fetch';
import { AbortSignal } from 'node-fetch/externals'; // add this line
import { APP_USER_AGENT } from 'app/app.constants';
import { ConfigService } from 'common/config';
import { PrometheusService } from 'common/prometheus';
import { RPC_NETWORK_NAME } from 'common/prometheus/prometheus.constants';
import {
  normalizeConsensusApiPath,
  normalizeRpcProvider,
  toResponseCodeClass,
} from 'common/prometheus/rpc-metrics.util';
import { CONSENSUS_REQUEST_TIMEOUT } from './consensus-provider.constants';

@Injectable()
export class ConsensusFetchService extends FetchService {
  constructor(
    options: FetchModuleOptions,
    middlewareService: MiddlewareService<Promise<Response>>,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    protected readonly prometheusService: PrometheusService,
  ) {
    super(options, middlewareService);
  }

  /**
   * Adds timeout to the source method of fetch service, and records the standard
   * RPC metrics policy set (in addition to the legacy `clApiRequestDuration`, which
   * stays wired via the middleware in consensus-fetch.module.ts).
   */
  protected async request(url: RequestInfo, init?: RequestInit, attempt = 0) {
    const controller = new AbortController();
    const { signal } = controller;

    setTimeout(() => {
      controller.abort();
    }, CONSENSUS_REQUEST_TIMEOUT);

    const headers = new Headers(init?.headers);
    headers.set('User-Agent', APP_USER_AGENT);

    const rpcLabels = {
      network: RPC_NETWORK_NAME,
      layer: 'cl',
      chain_id: String(this.configService.get('CHAIN_ID')),
      provider: normalizeRpcProvider(this.resolveFullUrl(url, attempt)),
    };
    const method = normalizeConsensusApiPath(String(url));
    const requestPayloadBytes = init?.body ? Buffer.byteLength(String(init.body)) : 0;
    const startedAt = Date.now();

    let result: Response;
    try {
      result = await super.request(
        url,
        {
          ...init,
          headers,
          signal: signal as AbortSignal,
        },
        attempt,
      );
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : undefined;
      this.observeRpcMetrics(rpcLabels, method, requestPayloadBytes, startedAt, {
        result: 'fail',
        responseCode: toResponseCodeClass(status),
        responsePayloadBytes: 0,
      });
      throw error;
    }

    this.observeRpcMetrics(rpcLabels, method, requestPayloadBytes, startedAt, {
      result: 'success',
      responseCode: toResponseCodeClass(result.status),
      responsePayloadBytes: Number(result.headers.get('content-length')) || 0,
    });

    const responseHeaders = Object.fromEntries(result.headers.entries());

    this.logger.debug('Consensus request trace', {
      requestUrl: String(url),
      requestHeaders: Object.fromEntries(headers.entries()),
      responseUrl: result.url, // safe here (logger removes secret api key)
      responseStatus: result.status,
      responseHeaders,
    });

    result.body.once('error', (error) => {
      this.logger.error('Consensus response stream error', {
        requestUrl: String(url),
        requestHeaders: Object.fromEntries(headers.entries()),
        responseUrl: result.url, // safe here (logger removes secret api key)
        responseStatus: result.status,
        responseHeaders,
        error,
      });
    });

    result.body.once('end', () => {
      this.logger.debug('Consensus response stream completed', {
        requestUrl: String(url),
        requestHeaders: Object.fromEntries(headers.entries()),
        responseUrl: result.url, // safe here (logger removes secret api key)
        responseStatus: result.status,
        responseHeaders,
      });
    });

    return result;
  }

  // Mirrors FetchService's own base-URL resolution (protected getBaseUrl/getUrl) so the
  // `provider` label reflects the connection this attempt actually used.
  private resolveFullUrl(url: RequestInfo, attempt: number): string {
    const baseUrl = this.getBaseUrl(attempt + 1);
    const fullUrl = this.getUrl(baseUrl, url);
    return typeof fullUrl === 'string' ? fullUrl : '';
  }

  private observeRpcMetrics(
    rpcLabels: { network: string; layer: string; chain_id: string; provider: string },
    method: string,
    requestPayloadBytes: number,
    startedAt: number,
    outcome: { result: 'success' | 'fail'; responseCode: string; responsePayloadBytes: number },
  ): void {
    this.prometheusService.httpRpcRequestsTotal.inc({
      ...rpcLabels,
      batched: 'false',
      response_code: outcome.responseCode,
      result: outcome.result,
    });
    this.prometheusService.httpRpcBatchSize.observe(rpcLabels, 1);
    this.prometheusService.httpRpcResponseSeconds.observe(rpcLabels, (Date.now() - startedAt) / 1000);
    this.prometheusService.httpRpcRequestPayloadBytes.observe(rpcLabels, requestPayloadBytes);
    if (outcome.responsePayloadBytes > 0) {
      this.prometheusService.httpRpcResponsePayloadBytes.observe(rpcLabels, outcome.responsePayloadBytes);
    }
    this.prometheusService.rpcRequestTotal.inc({
      ...rpcLabels,
      method,
      result: outcome.result,
      rpc_error_code: '',
    });
  }
}
