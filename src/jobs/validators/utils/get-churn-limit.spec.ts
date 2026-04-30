import { BigNumber } from '@ethersproject/bignumber';
import { getChurnLimit, getChurnLimitGwei, getConsolidationChurnLimit } from './get-churn-limit';

describe('getChurnLimit', () => {
  it('keeps the minimum churn floor for small active balance', () => {
    const totalActiveBalanceGwei = BigNumber.from('32000000000').mul(1000);

    expect(getChurnLimit(totalActiveBalanceGwei).toNumber()).toBe(4);
    expect(getChurnLimitGwei(totalActiveBalanceGwei).toString()).toBe('128000000000');
  });

  it('uses the EIP-8061 exit churn quotient without a 256 ETH cap', () => {
    const totalActiveBalanceGwei = BigNumber.from('36000000000000000'); // 36M ETH in Gwei

    expect(getChurnLimit(totalActiveBalanceGwei).toNumber()).toBe(34);
    expect(getChurnLimitGwei(totalActiveBalanceGwei).toString()).toBe('1098632812500');
  });

  it('returns a separate consolidation churn estimate for future EIP-8080 use', () => {
    const totalActiveBalanceGwei = BigNumber.from('36000000000000000'); // 36M ETH in Gwei

    expect(getConsolidationChurnLimit(totalActiveBalanceGwei).toNumber()).toBe(17);
  });
});
