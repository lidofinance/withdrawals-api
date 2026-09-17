import { HealthCheckError } from '@nestjs/terminus';
import { MAX_BLOCK_DELAY_SECONDS } from './health.constants';

jest.mock('../consensus-provider', () => ({ ConsensusProviderService: class {} }));
jest.mock('../genesis-time', () => ({ GenesisTimeService: class {} }));

import { ConsensusProviderIndicator } from './consensus-provider.indicator';

describe('ConsensusProviderIndicator', () => {
  const nowTimestamp = 1_000_000;
  let consensusProvider: { getBlockHeader: jest.Mock };
  let genesisTime: { getSlotTime: jest.Mock };
  let indicator: ConsensusProviderIndicator;

  beforeEach(() => {
    consensusProvider = { getBlockHeader: jest.fn() };
    genesisTime = { getSlotTime: jest.fn() };
    indicator = new ConsensusProviderIndicator(consensusProvider as any, genesisTime as any);
    jest.spyOn(indicator as any, 'getNowTimestamp').mockReturnValue(nowTimestamp);
  });

  it('reports ready from a fresh CL head block', async () => {
    consensusProvider.getBlockHeader.mockResolvedValue({ data: { header: { message: { slot: '1' } } } });
    genesisTime.getSlotTime.mockReturnValue(nowTimestamp - MAX_BLOCK_DELAY_SECONDS + 1);

    await expect(indicator.isHealthy('consensusProvider')).resolves.toMatchObject({
      consensusProvider: { status: 'up' },
    });
    expect(consensusProvider.getBlockHeader).toHaveBeenCalledWith({ blockId: 'head' });
  });

  it('reports unready when CL is unavailable or stale', async () => {
    consensusProvider.getBlockHeader.mockRejectedValue(new Error('CL unavailable'));
    await expect(indicator.isHealthy('consensusProvider')).rejects.toBeInstanceOf(HealthCheckError);

    consensusProvider.getBlockHeader.mockResolvedValue({ data: { header: { message: { slot: '1' } } } });
    genesisTime.getSlotTime.mockReturnValue(nowTimestamp - MAX_BLOCK_DELAY_SECONDS);
    await expect(indicator.isHealthy('consensusProvider')).rejects.toBeInstanceOf(HealthCheckError);
  });
});
