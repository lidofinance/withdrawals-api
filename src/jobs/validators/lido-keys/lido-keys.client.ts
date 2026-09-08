import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from '../../../common/logger';
import { ConfigService } from '../../../common/config';
import { PrometheusService } from '../../../common/prometheus/prometheus.service';
import { LidoKeysData } from './lido-keys.types';

@Injectable()
export class LidoKeysClient implements OnModuleInit {
  protected endpoints = {
    usedKeys: '/v1/keys?used=true',
  };

  protected basePath: string;

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    protected readonly prometheusService: PrometheusService,
  ) {}

  async onModuleInit() {
    this.basePath = await this.configService.getKeysApiBasePath();
  }

  public async getUsedKeys() {
    const url = this.basePath + this.endpoints.usedKeys;
    const target = 'lido-keys-api';
    let status = 'network_error';
    const endTimer = this.prometheusService.outgoingApiRequestDuration.startTimer({ target });

    try {
      const lidoKeysResponse = await fetch(url, {
        method: 'GET',
      });
      status = String(lidoKeysResponse.status);
      const lidoKeys: LidoKeysData = await lidoKeysResponse.json();
      return lidoKeys;
    } finally {
      this.prometheusService.outgoingApiRequestsTotal.inc({ target, status });
      endTimer({ status });
    }
  }
}
