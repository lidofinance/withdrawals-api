import { getOrCreateMetric } from '@willsoto/nestjs-prometheus';
import { Options, Metrics, Metric } from './interfaces';
import { METRICS_PREFIX } from './prometheus.constants';
import { RequestSourceType } from '../../http/request-time/headers/request-source-type';
import { ENV_KEYS } from '../config';

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
    labelNames: ['name', 'version', 'env', 'network'],
  });

  public envsInfo = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'envs_info',
    help: 'Environment variables information',
    labelNames: ENV_KEYS,
  });

  public validatorsState = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'validators_state',
    help: 'balances of Lido validators with withdrawable_epoch by frames',
    labelNames: ['frame', 'balance'],
  });

  public clApiRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'cl_api_requests_duration_seconds',
    help: 'CL API request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5, 10],
    labelNames: ['result', 'status'],
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
