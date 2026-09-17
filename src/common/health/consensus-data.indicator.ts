import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { ValidatorsStorageService } from 'storage/validators/validators.service';
import {
  MAX_VALIDATORS_DATA_DELAY_SECONDS,
  MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS,
} from './health.constants';

@Injectable()
export class ConsensusDataHealthIndicator extends HealthIndicator {
  constructor(private readonly validatorsStorage: ValidatorsStorageService) {
    super();
  }

  public async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const validatorsLastUpdate = this.validatorsStorage.getLastUpdate();
    const withdrawableLidoValidatorsLastUpdate = this.validatorsStorage.getWithdrawableLidoValidatorsLastUpdate();
    const nowTimestamp = this.getNowTimestamp();
    const validatorsAgeSeconds = validatorsLastUpdate === null ? null : Math.abs(nowTimestamp - validatorsLastUpdate);
    const withdrawableLidoValidatorsAgeSeconds =
      withdrawableLidoValidatorsLastUpdate === null
        ? null
        : Math.abs(nowTimestamp - withdrawableLidoValidatorsLastUpdate);

    const isHealthy =
      validatorsAgeSeconds !== null &&
      validatorsAgeSeconds < MAX_VALIDATORS_DATA_DELAY_SECONDS &&
      withdrawableLidoValidatorsAgeSeconds !== null &&
      withdrawableLidoValidatorsAgeSeconds < MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS;
    const result = this.getStatus(key, isHealthy, {
      validatorsLastUpdate,
      withdrawableLidoValidatorsLastUpdate,
      nowTimestamp,
      validatorsAgeSeconds,
      withdrawableLidoValidatorsAgeSeconds,
    });

    if (isHealthy) return result;
    throw new HealthCheckError('Cached consensus data is stale', result);
  }

  protected getNowTimestamp() {
    return Math.floor(Date.now() / 1000);
  }
}
