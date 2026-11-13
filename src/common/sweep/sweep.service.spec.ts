jest.mock('common/config', () => ({ ConfigService: class {} }));

import { BigNumber } from '@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import { IndexedValidator } from 'common/consensus-provider/consensus-provider.types';
import { isPartiallyWithdrawableValidator } from 'jobs/validators/utils/validator-state-utils';
import { SweepService } from './sweep.service';

const GWEI = BigNumber.from(10).pow(9);

const indexedValidator = (index: string, balanceEth: string, effectiveBalanceEth = '32'): IndexedValidator =>
  ({
    index,
    balance: parseEther(balanceEth).div(GWEI).toString(),
    validator: {
      withdrawal_credentials: '0x01' + '00'.repeat(31),
      effective_balance: parseEther(effectiveBalanceEth).div(GWEI).toString(),
      withdrawable_epoch: '18446744073709551615',
      exit_epoch: '18446744073709551615',
      activation_epoch: '0',
    },
  } as unknown as IndexedValidator);

describe('SweepService.getValidatorsWithdrawalsNumber', () => {
  const service = new SweepService({ log: jest.fn() } as never, {} as never);

  it('sums several pending partial withdrawals of one validator', () => {
    // 34 ETH with 2 x 0.5 ETH pending leaves 33 ETH: still above 32 ETH, so it is swept once.
    const validators = [indexedValidator('1', '34')];
    const withdrawals = [
      { validatorIndex: '1', amount: parseEther('0.5') },
      { validatorIndex: '1', amount: parseEther('0.5') },
    ];

    expect(service.getValidatorsWithdrawalsNumber(withdrawals, validators, 0)).toBe(1);
  });

  it('leaves a validator out when its pending partial withdrawals take all the excess', () => {
    const validators = [indexedValidator('1', '33')];
    const withdrawals = [
      { validatorIndex: '1', amount: parseEther('0.5') },
      { validatorIndex: '1', amount: parseEther('0.5') },
    ];

    expect(service.getValidatorsWithdrawalsNumber(withdrawals, validators, 0)).toBe(0);
  });
});

describe('isPartiallyWithdrawableValidator', () => {
  it('compares balances as numbers, not as strings', () => {
    // "100000000000000000000" < "32000000000000000000" as strings
    const { validator } = indexedValidator('1', '100');
    expect(isPartiallyWithdrawableValidator(validator, parseEther('100'))).toBe(true);
    expect(isPartiallyWithdrawableValidator(validator, parseEther('32'))).toBe(false);
  });
});
