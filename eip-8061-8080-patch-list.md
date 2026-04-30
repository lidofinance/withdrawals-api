# EIP-8061 and EIP-8080 Patch List

This document captures the required and likely changes for this repo to support the protocol changes described by EIP-8061 and EIP-8080.

## Summary

- `EIP-8061`: required
- `EIP-8080`: required
- Recommended implementation order:
  1. implement `8061`
  2. implement `8080` on top of it

## EIP-8061

### Required code changes

- Replace the current single capped churn model with separate activation, exit, and consolidation churn helpers.
  - Update [src/jobs/validators/utils/get-churn-limit.ts](src/jobs/validators/utils/get-churn-limit.ts)
  - Add:
    - `getActivationChurnLimitGwei`
    - `getExitChurnLimitGwei`
    - `getConsolidationChurnLimitGwei`
  - Use `CHURN_LIMIT_QUOTIENT_GLOAS = 2**15`
  - Use `CONSOLIDATION_CHURN_LIMIT_QUOTIENT = 2**16`
  - Keep activation capped at `256 ETH`
  - Remove the `256 ETH` cap from exit churn

- Store the correct churn values in validator storage instead of one generic `churnLimit`.
  - Update [src/jobs/validators/validators.service.ts](src/jobs/validators/validators.service.ts)
  - Update [src/storage/validators/validators.service.ts](src/storage/validators/validators.service.ts)
  - Add fields/getters/setters for:
    - `activationChurnLimit`
    - `exitChurnLimit`
    - `consolidationChurnLimit`

- Update cache persistence for the new churn fields if restart consistency is required.
  - Update [src/storage/validators/validators-cache.service.ts](src/storage/validators/validators-cache.service.ts)
  - Either:
    - extend cache format, or
    - recompute churn after boot and do not cache it

- Update waiting-time calculations to use exit churn, not the old unified capped churn.
  - Update [src/waiting-time/waiting-time.service.ts](src/waiting-time/waiting-time.service.ts)
  - `calculateFrameExitValidatorsCaseWithVEBO()` should use `exitChurnLimit`
  - `calculateRequestTimeSimple()` should also use exit churn

- Replace old constants where they feed exit ETA assumptions.
  - Update [src/waiting-time/waiting-time.constants.ts](src/waiting-time/waiting-time.constants.ts)
  - Remove the old single `CHURN_LIMIT_QUOTIENT` assumption where it feeds exit-time estimation

### Tests

- Add tests for post-8061 churn behavior:
  - uncapped exits above `256 ETH`
  - activation still capped
  - consolidation derived separately

## EIP-8080

### Required code changes

- Extend exit ETA logic to include the case where exits can consume consolidation churn.
  - Main patch point: [src/waiting-time/waiting-time.service.ts](src/waiting-time/waiting-time.service.ts)

- Add a helper that computes effective exit throughput under 8080.
  - Include:
    - base exit churn
    - extra exit capacity from consolidation churn when usable
  - The EIP states effective maximum exit churn becomes:
    - `get_activation_exit_churn_limit(state) + 3 * get_consolidation_churn_limit(state) // 2`
  - Translate that carefully to the repo's post-8061 split churn model

- Decide how the app determines whether consolidation churn is actually available.
  - Best version:
    - read consolidation queue state from consensus / chain if accessible
  - Fallback version:
    - config flag or network-fork assumption
  - Without queue-state visibility, any 8080 support will be approximate

- Feed that effective exit throughput into:
  - `calculateFrameExitValidatorsCaseWithVEBO()`
  - `calculateRequestTimeSimple()`

### Tests

- Add tests for:
  - no consolidation capacity available -> same as 8061 exit ETA
  - consolidation capacity available -> faster exit ETA
  - large queue cases to confirm ETA decreases

## Open design question

- `8061` is straightforward from current active balance and protocol constants.
- `8080` is not fully straightforward for this app because the estimator currently does not track consolidation-queue occupancy.

That means:

- `8061` can be implemented deterministically
- `8080` likely needs a new data source or an explicit approximation policy

## Recommended order

1. Implement `8061` churn split and tests.
2. Add storage/cache changes if needed.
3. Add `8080` effective-exit-throughput logic behind a feature/fork gate.
4. Add tests showing pre/post-8080 estimates differ only when consolidation churn is available.
