import { BigNumber } from '@ethersproject/bignumber';
import { WITHDRAWALS_VALIDATORS_PER_SLOT } from '../validators.constants';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from 'common/genesis-time';

/**
 * Estimates when a validator will be swept, starting from the next validator index
 * that the consensus layer plans to process. If the validator is not yet withdrawable,
 * the cursor is advanced only across the slots between now and `withdrawableEpoch`.
 * `blockedByDeferredSlots` models deferred-withdrawal flow, where the next sweep is
 * temporarily blocked until outstanding withdrawals are fulfilled in execution.
 *
 * @param validatorIndex Validator index whose expected sweep time is being estimated.
 * @param sweepCursorValidatorIndex Next validator index that the CL sweep cursor will process.
 * @param activeValidatorCount Number of active validators used to approximate sweep density.
 * @param totalValidatorsCount Total validator set size used for circular cursor movement.
 * @param currentEpoch Current epoch at the moment of estimation.
 * @param withdrawableEpoch Epoch at which the validator becomes withdrawable.
 * @param blockedByDeferredSlots Number of slots during which sweep progress is blocked by deferred withdrawals.
 * @param nowMs Base timestamp for the estimate in milliseconds.
 * @param validatorsPerSlot Maximum number of validators that can be processed per slot.
 * @param slotsPerEpoch Number of slots in one epoch.
 * @param secondsPerSlot Slot duration in seconds.
 * @returns Estimated Unix timestamp in milliseconds when the validator is expected to be swept.
 */
export function getValidatorWithdrawalTimestamp({
  validatorIndex,
  sweepCursorValidatorIndex,
  activeValidatorCount,
  totalValidatorsCount,
  currentEpoch,
  withdrawableEpoch,
  blockedByDeferredSlots = 0,
  nowMs = Date.now(),
  validatorsPerSlot = WITHDRAWALS_VALIDATORS_PER_SLOT,
  slotsPerEpoch = SLOTS_PER_EPOCH,
  secondsPerSlot = SECONDS_PER_SLOT,
}: {
  validatorIndex: BigNumber;
  sweepCursorValidatorIndex: BigNumber;
  totalValidatorsCount: number;
  activeValidatorCount: number;
  currentEpoch: number;
  withdrawableEpoch: number;
  blockedByDeferredSlots?: number;
  nowMs?: number;
  validatorsPerSlot?: number;
  slotsPerEpoch?: number;
  secondsPerSlot?: number;
}): number {
  const total = totalValidatorsCount;
  const vIdx = validatorIndex.toNumber();
  const sweepStartIdx = sweepCursorValidatorIndex.toNumber();
  const percentOfActiveValidators = activeValidatorCount / totalValidatorsCount;

  const epochsUntilWE = Math.max(0, withdrawableEpoch - currentEpoch);
  const slotsUntilWE = epochsUntilWE * slotsPerEpoch;

  // Deferred withdrawals temporarily stop the cursor. Only the remaining free slots
  // can advance the sweep before the validator becomes withdrawable.
  const effectiveSweepSlotsBeforeWE = Math.max(0, slotsUntilWE - blockedByDeferredSlots);
  const blockedSlotsAfterWE = Math.max(0, blockedByDeferredSlots - slotsUntilWE);

  // Project where the sweep cursor will be by the time the validator reaches
  // `withdrawableEpoch`, using active-validator density as a throughput approximation.
  const expectedIndexAdvanceToWE = Math.floor(
    (effectiveSweepSlotsBeforeWE * validatorsPerSlot) / percentOfActiveValidators,
  );
  const cursorAtWE = (sweepStartIdx + (expectedIndexAdvanceToWE % total)) % total;

  // After the validator is withdrawable, estimate how many active validators the
  // cursor still needs to pass before it reaches `validatorIndex`.
  const queuePosInclusive = ((vIdx - cursorAtWE + total) % total) + 1;
  const expectedActivesToProcess = Math.ceil((queuePosInclusive - 1) * percentOfActiveValidators) + 1;

  const slotsAfterWE = Math.ceil(expectedActivesToProcess / validatorsPerSlot);

  // Final ETA = time until withdrawable epoch + deferred blocking that spills past it
  // + slots needed for the cursor to reach the validator.
  const totalSlots = slotsUntilWE + blockedSlotsAfterWE + slotsAfterWE;

  const totalSeconds = totalSlots * secondsPerSlot;
  return nowMs + totalSeconds * 1000;
}
