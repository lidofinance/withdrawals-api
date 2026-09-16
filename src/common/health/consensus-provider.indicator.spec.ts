import { HealthCheckError } from '@nestjs/terminus';
import { ValidatorsStorageService } from 'storage/validators/validators.service';
import {
  MAX_VALIDATORS_DATA_DELAY_SECONDS,
  MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS,
} from './health.constants';
import { ConsensusProviderIndicator } from './consensus-provider.indicator';

describe('ConsensusProviderIndicator', () => {
  const nowTimestamp = 1_000_000;
  let validatorsStorage: jest.Mocked<
    Pick<ValidatorsStorageService, 'getLastUpdate' | 'getWithdrawableLidoValidatorsLastUpdate'>
  >;
  let indicator: ConsensusProviderIndicator;

  beforeEach(() => {
    validatorsStorage = {
      getLastUpdate: jest.fn(),
      getWithdrawableLidoValidatorsLastUpdate: jest.fn(),
    };
    indicator = new ConsensusProviderIndicator(validatorsStorage as unknown as ValidatorsStorageService);
    jest.spyOn(indicator as any, 'getNowTimestamp').mockReturnValue(nowTimestamp);
  });

  it('reports ready from fresh cached validator data without calling CL', async () => {
    validatorsStorage.getLastUpdate.mockReturnValue(nowTimestamp - MAX_VALIDATORS_DATA_DELAY_SECONDS + 1);
    validatorsStorage.getWithdrawableLidoValidatorsLastUpdate.mockReturnValue(
      nowTimestamp - MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS + 1,
    );

    await expect(indicator.isHealthy('consensusProvider')).resolves.toMatchObject({
      consensusProvider: {
        status: 'up',
        validatorsLastUpdate: nowTimestamp - MAX_VALIDATORS_DATA_DELAY_SECONDS + 1,
        withdrawableLidoValidatorsLastUpdate: nowTimestamp - MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS + 1,
      },
    });
  });

  it('reports unready when cached validator data is missing or stale', async () => {
    validatorsStorage.getLastUpdate.mockReturnValue(null);
    validatorsStorage.getWithdrawableLidoValidatorsLastUpdate.mockReturnValue(nowTimestamp);
    await expect(indicator.isHealthy('consensusProvider')).rejects.toBeInstanceOf(HealthCheckError);

    validatorsStorage.getLastUpdate.mockReturnValue(nowTimestamp);
    validatorsStorage.getWithdrawableLidoValidatorsLastUpdate.mockReturnValue(
      nowTimestamp - MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS,
    );
    await expect(indicator.isHealthy('consensusProvider')).rejects.toBeInstanceOf(HealthCheckError);
  });
});
