import { HealthCheckError } from '@nestjs/terminus';
import { ValidatorsStorageService } from 'storage/validators/validators.service';
import {
  MAX_VALIDATORS_DATA_DELAY_SECONDS,
  MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS,
} from './health.constants';
import { ConsensusDataHealthIndicator } from './consensus-data.indicator';

describe('ConsensusDataHealthIndicator', () => {
  const nowTimestamp = 1_000_000;
  let validatorsStorage: jest.Mocked<
    Pick<ValidatorsStorageService, 'getLastUpdate' | 'getWithdrawableLidoValidatorsLastUpdate'>
  >;
  let indicator: ConsensusDataHealthIndicator;

  beforeEach(() => {
    validatorsStorage = {
      getLastUpdate: jest.fn(),
      getWithdrawableLidoValidatorsLastUpdate: jest.fn(),
    };
    indicator = new ConsensusDataHealthIndicator(validatorsStorage as unknown as ValidatorsStorageService);
    jest.spyOn(indicator as any, 'getNowTimestamp').mockReturnValue(nowTimestamp);
  });

  it('reports ready when both cached CL data sets are fresh', async () => {
    validatorsStorage.getLastUpdate.mockReturnValue(nowTimestamp - MAX_VALIDATORS_DATA_DELAY_SECONDS + 1);
    validatorsStorage.getWithdrawableLidoValidatorsLastUpdate.mockReturnValue(
      nowTimestamp - MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS + 1,
    );

    await expect(indicator.isHealthy('cachedConsensusData')).resolves.toMatchObject({
      cachedConsensusData: { status: 'up' },
    });
  });

  it('reports unready when either cached CL data set is missing or stale', async () => {
    validatorsStorage.getLastUpdate.mockReturnValue(null);
    validatorsStorage.getWithdrawableLidoValidatorsLastUpdate.mockReturnValue(nowTimestamp);
    await expect(indicator.isHealthy('cachedConsensusData')).rejects.toBeInstanceOf(HealthCheckError);

    validatorsStorage.getLastUpdate.mockReturnValue(nowTimestamp);
    validatorsStorage.getWithdrawableLidoValidatorsLastUpdate.mockReturnValue(
      nowTimestamp - MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS,
    );
    await expect(indicator.isHealthy('cachedConsensusData')).rejects.toBeInstanceOf(HealthCheckError);
  });
});
