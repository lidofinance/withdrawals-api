import { parseEther } from '@ethersproject/units';
import { MAX_EFFECTIVE_BALANCE_ELECTRA } from 'waiting-time/waiting-time.constants';
import { BigNumber } from '@ethersproject/bignumber';
import { parseGwei } from 'common/utils/parse-gwei';
import { Validator } from '../../../common/consensus-provider/consensus-provider.types';

const COMPOUNDING_WITHDRAWAL_PREFIX = '0x02';
const ETH1_ADDRESS_WITHDRAWAL_PREFIX = '0x01';

const MIN_ACTIVATION_BALANCE = parseEther('32');

/**
 * Get max effective balance for ``validator``.
 * https://github.com/ethereum/consensus-specs/blob/dev/specs/electra/beacon-chain.md#new-get_max_effective_balance
 */
export function getMaxEffectiveBalance(validator: Validator): BigNumber {
  return hasCompoundingWithdrawalCredential(validator) ? MAX_EFFECTIVE_BALANCE_ELECTRA : MIN_ACTIVATION_BALANCE;
}

export function hasCompoundingWithdrawalCredential(validator: Validator): boolean {
  return validator.withdrawal_credentials.startsWith(COMPOUNDING_WITHDRAWAL_PREFIX);
}

export function hasEth1WithdrawalCredential(validator: Validator): boolean {
  return validator.withdrawal_credentials.startsWith(ETH1_ADDRESS_WITHDRAWAL_PREFIX);
}

export function hasExecutionWithdrawalCredential(validator: Validator): boolean {
  return hasCompoundingWithdrawalCredential(validator) || hasEth1WithdrawalCredential(validator);
}

export function isPartiallyWithdrawableValidator(validator: Validator, balance: BigNumber): boolean {
  const maxEffectiveBalance = getMaxEffectiveBalance(validator);
  const hasMaxEffectiveBalance = parseGwei(validator.effective_balance).eq(maxEffectiveBalance);
  const hasExcessBalance = balance > maxEffectiveBalance;

  return hasExecutionWithdrawalCredential(validator) && hasMaxEffectiveBalance && hasExcessBalance;
}

export function isFullyWithdrawableValidator(validator: Validator, balance: BigNumber, epoch: number): boolean {
  return hasExecutionWithdrawalCredential(validator) && +validator.withdrawable_epoch <= epoch && balance.gt(0);
}

/**
 * https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#is_active_validator
 */
function isActiveValidator(validator: Validator, epoch: number): boolean {
  return +validator.activation_epoch <= epoch && epoch < +validator.exit_epoch;
}
