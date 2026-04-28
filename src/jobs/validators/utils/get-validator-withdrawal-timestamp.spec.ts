import { BigNumber } from '@ethersproject/bignumber';
import { getValidatorWithdrawalTimestamp } from './get-validator-withdrawal-timestamp';

jest.mock('common/genesis-time', () => ({
  SECONDS_PER_SLOT: 12,
  SLOTS_PER_EPOCH: 32,
}));

describe('getValidatorWithdrawalTimestampV2', () => {
  it('treats the sweep cursor as the next validator to be processed', () => {
    const nowMs = 1_000;

    const result = getValidatorWithdrawalTimestamp({
      validatorIndex: BigNumber.from(10),
      sweepCursorValidatorIndex: BigNumber.from(10),
      totalValidatorsCount: 100,
      activeValidatorCount: 100,
      currentEpoch: 100,
      withdrawableEpoch: 100,
      nowMs,
      validatorsPerSlot: 16,
      slotsPerEpoch: 32,
      secondsPerSlot: 12,
    });

    expect(result).toBe(nowMs + 12_000);
  });

  it('adds blocked slots when withdrawals are deferred and the validator is already withdrawable', () => {
    const nowMs = 1_000;

    const result = getValidatorWithdrawalTimestamp({
      validatorIndex: BigNumber.from(10),
      sweepCursorValidatorIndex: BigNumber.from(10),
      totalValidatorsCount: 100,
      activeValidatorCount: 100,
      currentEpoch: 100,
      withdrawableEpoch: 100,
      blockedByDeferredSlots: 3,
      nowMs,
      validatorsPerSlot: 16,
      slotsPerEpoch: 32,
      secondsPerSlot: 12,
    });

    expect(result).toBe(nowMs + 48_000);
  });
});
