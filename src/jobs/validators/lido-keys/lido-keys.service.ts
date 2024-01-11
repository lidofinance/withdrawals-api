import { Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { LidoKey, LidoKeysData } from './lido-keys.types';
import { KEYS_API_ADDRESS } from './lido-keys.constants';
import { Validator } from '../validators.types';

export class LidoKeysService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
  ) {}

  public async fetchLidoKeysData() {
    const lidoKeysResponse = await fetch(KEYS_API_ADDRESS[this.configService.get('CHAIN_ID')], {
      method: 'GET',
    });
    const lidoKeys: LidoKeysData = await lidoKeysResponse.json();
    return lidoKeys;
  }

  public async getLidoValidatorsByKeys(keys: LidoKey[], validators: Validator[]) {
    const keysDict = keys.reduce((acc, lidoKey) => {
      acc[lidoKey.key] = true;
      return acc;
    }, {});
    return validators.filter((v) => keysDict[v.validator?.pubkey]);
  }
}
