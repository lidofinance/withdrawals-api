# EIP-8080 TODO

This document captures the `EIP-8080` work and remaining follow-ups in this repo.

## Scope

`EIP-8080` lets exits use consolidation churn when the consolidation path is earlier than the exit path. For this app, that affects only exit waiting-time estimation.

It does not directly affect:
- `getValidatorWithdrawalTimestamp`
- sweep cursor logic
- validators that already have a CL-provided `withdrawable_epoch`

Relevant EIP:
- https://eips.ethereum.org/EIPS/eip-8080

## What We Already Have

- `exitChurnLimit` is stored in validator storage.
- `consolidationChurnLimit` is stored in validator storage and cache.
- `8061` compatibility is already fork-gated through the Glamsterdam check.
- CL queue-tail epochs are stored:
  - `earliest_exit_epoch`
  - `earliest_consolidation_epoch`
- waiting-time now routes through consolidation only when:
  - Glamsterdam is active
  - `earliest_exit_epoch > earliest_consolidation_epoch`

That means the exact queue-tail routing part is implemented. Remaining work is only if we want an even more exact historical or queue-state-aware model.

## Current Strategy

Current assumption:
- treat `8080` as part of Glamsterdam for supported networks
- reuse `isGlamsterdam`

## Current Implementation

The app now uses exact current queue-tail routing, not the earlier always-on heuristic.

Behavior:
- before Glamsterdam:
  - `effectiveExitChurnLimit = exitChurnLimit`
- after Glamsterdam:
  - if `earliest_exit_epoch > earliest_consolidation_epoch`:
    - route through consolidation
    - `effectiveExitChurnLimit = floor(3 * consolidationChurnLimit / 2)`
    - route start epoch = `earliest_consolidation_epoch`
  - otherwise:
    - use normal exit routing
    - `effectiveExitChurnLimit = exitChurnLimit`
    - route start epoch = exit queue path

Reason for `3 / 2`:
- `8080` routes exits through consolidation using `2 * exit_balance // 3`
- so one unit of consolidation churn can carry `3 / 2` units of exit balance

## Code Changes

### 1. Effective exit routing helper

Add a helper in:
- [src/waiting-time/waiting-time.service.ts](src/waiting-time/waiting-time.service.ts)

Current shape:
- read `exitChurnLimit`
- read `consolidationChurnLimit`
- read:
  - `earliest_exit_epoch`
  - `earliest_consolidation_epoch`
- if not Glamsterdam, use exit route
- if Glamsterdam and consolidation is earlier, use consolidation route

### 2. Use it in exit-validator ETA

Patch:
- [src/waiting-time/waiting-time.service.ts](src/waiting-time/waiting-time.service.ts)

Functions:
- `calculateFrameExitValidatorsCaseWithVEBO()`
- `calculateRequestTimeSimple()`

Both now use route-aware effective churn, not raw `exitChurnLimit`.

### 3. Keep `getValidatorWithdrawalTimestamp` unchanged

Do not patch:
- [src/jobs/validators/utils/get-validator-withdrawal-timestamp.ts](src/jobs/validators/utils/get-validator-withdrawal-timestamp.ts)

Reason:
- it estimates only post-`withdrawable_epoch` sweep delay
- `8080` changes exit routing before `withdrawable_epoch`, not sweep traversal after it

## Tests

Add tests showing:
- before Glamsterdam:
  - effective churn equals `exitChurnLimit`
- after Glamsterdam:
  - effective churn includes `3 / 2 * consolidationChurnLimit`
- `calculateRequestTimeSimple()` gets shorter after Glamsterdam when consolidation churn is non-zero
- `calculateFrameExitValidatorsCaseWithVEBO()` gets shorter after Glamsterdam when consolidation churn is non-zero

Implemented patch points:
- [src/waiting-time/waiting-time.service.spec.ts](src/waiting-time/waiting-time.service.spec.ts)
- [src/storage/validators/validators-cache.service.spec.ts](src/storage/validators/validators-cache.service.spec.ts)

