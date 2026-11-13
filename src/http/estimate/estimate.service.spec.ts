import { BigNumber } from '@ethersproject/bignumber';
import { CHAINS } from '@lido-nestjs/constants';
import { EstimateService } from './estimate.service';

jest.mock('common/config', () => ({ ConfigService: class {} }));

describe('EstimateService', () => {
  const createService = (chainId: number) => {
    const logger = { error: jest.fn() };
    const estimateGas = {
      requestWithdrawalsWithPermit: jest.fn(),
      requestWithdrawalsWstETHWithPermit: jest.fn(),
    };
    const service = new EstimateService(
      logger as any,
      { get: jest.fn().mockReturnValue(chainId) } as any,
      { estimateGas } as any,
    );
    return { service, estimateGas, logger };
  };

  it.each([
    ['steth', 1, 600000],
    ['steth', 3, 1800000],
    ['wsteth', 1, 750000],
    ['wsteth', 3, 2250000],
  ])('returns the Hoodi fallback for %s with %i requests', async (token, requestCount, gasLimit) => {
    const { service, estimateGas } = createService(CHAINS.Hoodi);

    await expect(service.getEstimate({ token, requestCount })).resolves.toEqual({ gasLimit });
    expect(estimateGas.requestWithdrawalsWithPermit).not.toHaveBeenCalled();
    expect(estimateGas.requestWithdrawalsWstETHWithPermit).not.toHaveBeenCalled();
  });

  it.each([
    ['steth', 'requestWithdrawalsWithPermit', 600000],
    ['wsteth', 'requestWithdrawalsWstETHWithPermit', 750000],
  ] as const)('uses the updated %s fallback on RPC failure', async (token, method, fallback) => {
    const { service, estimateGas, logger } = createService(CHAINS.Mainnet);
    estimateGas[method].mockRejectedValue(new Error('RPC unavailable'));

    await expect(service.getEstimate({ token, requestCount: 2 })).resolves.toEqual({ gasLimit: fallback * 2 });
    expect(estimateGas[method]).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it.each([
    ['steth', 'requestWithdrawalsWithPermit'],
    ['wsteth', 'requestWithdrawalsWstETHWithPermit'],
  ] as const)('preserves a successful RPC estimate for %s', async (token, method) => {
    const { service, estimateGas } = createService(CHAINS.Mainnet);
    estimateGas[method].mockResolvedValue(BigNumber.from(481000));

    await expect(service.getEstimate({ token, requestCount: 1 })).resolves.toEqual({ gasLimit: 481000 });
  });
});
