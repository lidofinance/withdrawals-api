import { BigNumber } from '@ethersproject/bignumber';
import { getExitChurnLimit, getExitChurnLimitGwei, getConsolidationChurnLimit } from './get-churn-limit';
import { MAINNET_CHURN_SPEC_PARAMS } from '../../../common/spec/churn-spec-params';

describe('getExitChurnLimit', () => {
  it('keeps the minimum churn floor for small active balance', () => {
    const totalActiveBalanceGwei = BigNumber.from('32000000000').mul(1000);

    expect(getExitChurnLimit(totalActiveBalanceGwei, false).toNumber()).toBe(4);
    expect(getExitChurnLimit(totalActiveBalanceGwei, true).toNumber()).toBe(4);
    expect(getExitChurnLimitGwei(totalActiveBalanceGwei, false).toString()).toBe('128000000000');
    expect(getExitChurnLimitGwei(totalActiveBalanceGwei, true).toString()).toBe('128000000000');
  });

  it('keeps the pre-8061 cap before the fork', () => {
    const totalActiveBalanceGwei = BigNumber.from('36000000000000000'); // 36M ETH in Gwei

    expect(getExitChurnLimit(totalActiveBalanceGwei, false).toNumber()).toBe(8);
    expect(getExitChurnLimitGwei(totalActiveBalanceGwei, false).toString()).toBe('256000000000');
  });

  it('uses the EIP-8061 exit churn quotient without a 256 ETH cap after the fork', () => {
    const totalActiveBalanceGwei = BigNumber.from('36000000000000000'); // 36M ETH in Gwei

    expect(getExitChurnLimit(totalActiveBalanceGwei, true).toNumber()).toBe(34);
    expect(getExitChurnLimitGwei(totalActiveBalanceGwei, true).toString()).toBe('1098632812500');
  });

  it('returns a separate consolidation churn estimate (EIP-8061 split)', () => {
    const totalActiveBalanceGwei = BigNumber.from('36000000000000000'); // 36M ETH in Gwei

    expect(getConsolidationChurnLimit(totalActiveBalanceGwei).toNumber()).toBe(17);
  });

  it('honors spec-provided quotient overrides (devnet configs)', () => {
    const totalActiveBalanceGwei = BigNumber.from('32000000000').mul(100_000); // 100k validators

    // glamsterdam devnet-8 style override: quotient 128 instead of 32768
    const devnetParams = {
      ...MAINNET_CHURN_SPEC_PARAMS,
      churnLimitQuotientGloas: BigNumber.from(128),
    };

    expect(getExitChurnLimit(totalActiveBalanceGwei, true, devnetParams).toNumber()).toBe(781); // 100k/128
    expect(getExitChurnLimit(totalActiveBalanceGwei, true).toNumber()).toBe(4); // mainnet quotient → floor
  });
});
