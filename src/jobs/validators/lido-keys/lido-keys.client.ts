import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from '../../../common/logger';
import { ConfigService } from '../../../common/config';
import { KEYS_API_PATHS } from './lido-keys.constants';
import { LidoKeysData } from './lido-keys.types';

@Injectable()
export class LidoKeysClient {
  protected endpoints = {
    usedKeys: '/v1/keys?used=true',
  };

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
  ) {}

  protected getBasePath(): string {
    const envUrl = this.configService.get('KEYS_API_BASE_PATH');

    if (envUrl) {
      return envUrl;
    }

    const chainId = this.configService.get('CHAIN_ID');
    return KEYS_API_PATHS[chainId];
  }

  public async getUsedKeys() {
    const url = this.getBasePath() + this.endpoints.usedKeys;
    const lidoKeysResponse = await fetch(url, {
      method: 'GET',
    });
    const lidoKeys: LidoKeysData = await lidoKeysResponse.json();
    return lidoKeys;
  }
}
