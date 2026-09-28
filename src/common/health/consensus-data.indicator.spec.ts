import { HealthCheckError } from '@nestjs/terminus';
import { ValidatorsStorageService } from 'storage/validators/validators.service';
import type { WaitingTimeService } from 'waiting-time';
import {
  MAX_VALIDATORS_DATA_DELAY_SECONDS,
  MAX_WITHDRAWABLE_LIDO_VALIDATORS_DATA_DELAY_SECONDS,
} from './health.constants';

jest.mock('waiting-time', () => ({ WaitingTimeService: class {} }));

import { ConsensusDataHealthIndicator } from './consensus-data.indicator';

describe('ConsensusDataHealthIndicator', () => {
  const nowTimestamp = 1_000_000;
  let validatorsStorage: jest.Mocked<
    Pick<ValidatorsStorageService, 'getLastUpdate' | 'getWithdrawableLidoValidatorsLastUpdate'>
  >;
  let waitingTime: jest.Mocked<Pick<WaitingTimeService, 'checkIsInitializing'>>;
  let indicator: ConsensusDataHealthIndicator;

  beforeEach(() => {
    validatorsStorage = {
      getLastUpdate: jest.fn(),
      getWithdrawableLidoValidatorsLastUpdate: jest.fn(),
    };
    waitingTime = { checkIsInitializing: jest.fn().mockReturnValue(null) };
    indicator = new ConsensusDataHealthIndicator(
      validatorsStorage as unknown as ValidatorsStorageService,
      waitingTime as unknown as WaitingTimeService,
    );
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

  it('reports unready while request-time data is initializing', async () => {
    validatorsStorage.getLastUpdate.mockReturnValue(nowTimestamp);
    validatorsStorage.getWithdrawableLidoValidatorsLastUpdate.mockReturnValue(nowTimestamp);
    waitingTime.checkIsInitializing.mockReturnValue(
      {} as NonNullable<ReturnType<WaitingTimeService['checkIsInitializing']>>,
    );

    await expect(indicator.isHealthy('cachedConsensusData')).rejects.toBeInstanceOf(HealthCheckError);
  });
});
