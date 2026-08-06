import { BigNumber } from '@ethersproject/bignumber';
import { ValidatorsCacheService } from './validators-cache.service';

jest.mock('common/config', () => ({}));

describe('ValidatorsCacheService', () => {
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  const createValidatorsStorage = () => ({
    setActiveValidatorsCount: jest.fn(),
    setMaxExitEpoch: jest.fn(),
    setLastUpdate: jest.fn(),
    setFrameBalances: jest.fn(),
    setSweepMeanEpochs: jest.fn(),
    setExitChurnLimit: jest.fn(),
    setConsolidationChurnLimit: jest.fn(),
    setEarliestExitEpoch: jest.fn(),
    setEarliestConsolidationEpoch: jest.fn(),
    getActiveValidatorsCount: jest.fn().mockReturnValue(10),
    getMaxExitEpoch: jest.fn().mockReturnValue('123'),
    getLastUpdate: jest.fn().mockReturnValue(456),
    getFrameBalances: jest.fn().mockReturnValue({ '1': BigNumber.from('2') }),
    getSweepMeanEpochs: jest.fn().mockReturnValue(7),
    getExitChurnLimit: jest.fn().mockReturnValue(8),
    getConsolidationChurnLimit: jest.fn().mockReturnValue(4),
    getEarliestExitEpoch: jest.fn().mockReturnValue('789'),
    getEarliestConsolidationEpoch: jest.fn().mockReturnValue('654'),
  });

  it('hydrates legacy cache data without consolidation churn', () => {
    const validatorsStorage = createValidatorsStorage();
    const service = new ValidatorsCacheService(logger as any, validatorsStorage as any);

    (service as any).hydrateStorageFromCacheData(['10', '123', '456', '{"1":"2"}', '7', '8']);

    expect(validatorsStorage.setActiveValidatorsCount).toHaveBeenCalledWith(10);
    expect(validatorsStorage.setMaxExitEpoch).toHaveBeenCalledWith('123');
    expect(validatorsStorage.setLastUpdate).toHaveBeenCalledWith(456);
    expect(validatorsStorage.setSweepMeanEpochs).toHaveBeenCalledWith(7);
    expect(validatorsStorage.setExitChurnLimit).toHaveBeenCalledWith(8);
    expect(validatorsStorage.setConsolidationChurnLimit).not.toHaveBeenCalled();
  });

  it('hydrates current cache data with consolidation churn', () => {
    const validatorsStorage = createValidatorsStorage();
    const service = new ValidatorsCacheService(logger as any, validatorsStorage as any);

    (service as any).hydrateStorageFromCacheData(['10', '123', '456', '{"1":"2"}', '7', '8', '4']);

    expect(validatorsStorage.setConsolidationChurnLimit).toHaveBeenCalledWith(4);
  });

  it('hydrates current cache data with exit-routing epochs', () => {
    const validatorsStorage = createValidatorsStorage();
    const service = new ValidatorsCacheService(logger as any, validatorsStorage as any);

    (service as any).hydrateStorageFromCacheData(['10', '123', '456', '{"1":"2"}', '7', '8', '4', '789', '654']);

    expect(validatorsStorage.setEarliestExitEpoch).toHaveBeenCalledWith('789');
    expect(validatorsStorage.setEarliestConsolidationEpoch).toHaveBeenCalledWith('654');
  });

  it('serializes consolidation churn into the current cache format', () => {
    const validatorsStorage = createValidatorsStorage();
    const service = new ValidatorsCacheService(logger as any, validatorsStorage as any);

    expect((service as any).getCacheData()).toEqual([10, '123', 456, '{"1":"2"}', 7, 8, 4, '789', '654']);
  });
});
