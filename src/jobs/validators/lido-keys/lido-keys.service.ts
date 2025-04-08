import { Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { IndexedValidator } from 'common/consensus-provider/consensus-provider.types';
import { ConfigService } from 'common/config';
import { LidoKey } from './lido-keys.types';
import { LidoKeysClient } from './lido-keys.client';

export class LidoKeysService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    protected readonly lidoKeysClient: LidoKeysClient,
  ) {}

  public async fetchLidoKeysData() {
    return this.lidoKeysClient.getUsedKeys();
  }

  public async getLidoValidatorsByKeys(keys: LidoKey[], validators: IndexedValidator[]) {
    const keysDict = keys.reduce((acc, lidoKey) => {
      acc[lidoKey.key] = true;
      return acc;
    }, {});
    return validators.filter((v) => keysDict[v.validator?.pubkey]);
  }
}
