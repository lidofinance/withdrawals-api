import { getOrCreateMetric } from '@willsoto/nestjs-prometheus';
import { Options, Metrics, Metric } from './interfaces';
import { METRICS_PREFIX } from './prometheus.constants';
import { RequestSourceType } from '../../http/request-time/headers/request-source-type';
// import directly to avoid loading ConfigModule and triggering env validation during tests
import { ENV_KEYS } from '../config/env.validation';

// Unprefixed on purpose: these follow the org-wide "Policy for standardizing blockchain
// RPC metrics" so dashboards/alerts are shared across apps by metric name, not per-app.
const RPC_LABEL_NAMES = ['network', 'layer', 'chain_id', 'provider'] as const;

export class PrometheusService {
  protected prefix = METRICS_PREFIX;

  protected getOrCreateMetric<T extends Metrics, L extends string>(type: T, options: Options<L>): Metric<T, L> {
    const prefixedName = options.prefix ? this.prefix + options.name : options.name;

    return getOrCreateMetric(type, {
      ...options,
      name: prefixedName,
    }) as Metric<T, L>;
  }

  public httpRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'http_requests_duration_seconds',
    help: 'Duration of http requests',
    buckets: [0.01, 0.1, 0.2, 0.5, 1, 1.5, 2, 5],
    labelNames: ['statusCode', 'method', 'route', 'version'],
  });

  public buildInfo = this.getOrCreateMetric('Gauge', {
    name: 'build_info',
    help: 'Build information',
    labelNames: ['name', 'version', 'env', 'network', 'branch', 'commit'],
  });

  public envsInfo = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'envs_info',
    help: 'Environment variables information',
    labelNames: ENV_KEYS,
  });

  public sumValidatorsBalances = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'sum_validators_balances',
    help: 'sum balances of Lido validators with withdrawable_epoch',
  });

  public balancesStateUnfinalized = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'balances_state_unfinalized',
    help: 'Unfinalized ETH balance',
  });

  public balancesStateBuffer = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'balances_state_buffer',
    help: 'Buffer ETH balance',
  });

  public balancesStateVaults = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'balances_state_vaults',
    help: 'Vaults ETH balance',
  });

  public clApiRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'cl_api_requests_duration_seconds',
    help: 'CL API request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5, 10],
    labelNames: ['result', 'status'],
  });

  public outgoingApiRequestsTotal = this.getOrCreateMetric('Counter', {
    name: METRICS_PREFIX + 'outgoing_api_requests_total',
    help: 'Outgoing API requests by target and HTTP status; network_error means no response',
    labelNames: ['target', 'status'],
  });

  public outgoingApiRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'outgoing_api_request_duration_seconds',
    help: 'Outgoing API request duration including response body decoding',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5, 10],
    labelNames: ['target', 'status'],
  });

  public clApiRetriesTotal = this.getOrCreateMetric('Counter', {
    name: METRICS_PREFIX + 'cl_api_retries_total',
    help: 'Number of CL API stream operation retries',
    labelNames: ['operation'],
  });

  public clApiRetryExhaustedTotal = this.getOrCreateMetric('Counter', {
    name: METRICS_PREFIX + 'cl_api_retry_exhausted_total',
    help: 'Number of CL API stream operations that exhausted all retry attempts',
    labelNames: ['operation'],
  });

  public jobDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'job_duration_seconds',
    help: 'Job execution duration',
    buckets: [0.2, 0.6, 1, 2, 3, 5, 8, 13, 30, 60],
    labelNames: ['result', 'job'],
  });

  public elRpcRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'el_rpc_requests_duration_seconds',
    help: 'EL RPC request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5],
    labelNames: ['result'],
  });

  /**
   * Standard RPC metrics policy set. Kept alongside `elRpcRequestDuration` /
   * `clApiRequestDuration` (not a replacement) so existing dashboards keep working.
   */
  public httpRpcRequestsTotal = this.getOrCreateMetric('Counter', {
    name: 'http_rpc_requests_total',
    help: 'Counts total HTTP requests used by any layer (EL, CL, or other)',
    labelNames: [...RPC_LABEL_NAMES, 'batched', 'response_code', 'result'],
  });

  public httpRpcBatchSize = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_batch_size',
    help: 'Distribution of how many JSON-RPC calls are bundled in each HTTP request',
    buckets: [1, 2, 5, 10, 20, 50, 100],
    labelNames: RPC_LABEL_NAMES,
  });

  public httpRpcResponseSeconds = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_response_seconds',
    help: 'Distribution of RPC response times',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    labelNames: RPC_LABEL_NAMES,
  });

  public httpRpcRequestPayloadBytes = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_request_payload_bytes',
    help: 'Distribution of RPC request payload sizes',
    buckets: [256, 512, 1024, 4096, 16384, 65536, 262144],
    labelNames: RPC_LABEL_NAMES,
  });

  public httpRpcResponsePayloadBytes = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_response_payload_bytes',
    help: 'Distribution of RPC response payload sizes',
    buckets: [256, 1024, 4096, 16384, 65536, 262144, 1048576],
    labelNames: RPC_LABEL_NAMES,
  });

  public rpcRequestTotal = this.getOrCreateMetric('Counter', {
    name: 'rpc_request_total',
    help: 'Total number of RPC requests made by the application',
    labelNames: [...RPC_LABEL_NAMES, 'method', 'result', 'rpc_error_code'],
  });

  public requestSource = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'requests_source',
    help: 'Sources of withdrawal time requests',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5],
    labelNames: ['requestSource', 'route', 'version'],
  });

  public rewardsEventTriggered = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'rewards_event_triggered',
    help: 'Rewards event triggered',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5],
    labelNames: ['result'],
  });

  public trackRequestSource(requestSource: RequestSourceType, route: string, version: number | string) {
    requestSource = Object.values(RequestSourceType).includes(requestSource)
      ? requestSource
      : RequestSourceType.unknown;
    this.requestSource.labels({ requestSource, route, version }).inc();
  }
}
