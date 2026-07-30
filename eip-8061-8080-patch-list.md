# EIP-8061 and EIP-8080 Patch List

This file is now a short index.

Current official drafts:
- EIP-8061: https://eips.ethereum.org/EIPS/eip-8061
- EIP-8080: https://eips.ethereum.org/EIPS/eip-8080

## EIP-8061

Current app-level `8061` work is implemented.

Relevant areas:
- exit churn helper:
  - [src/jobs/validators/utils/get-churn-limit.ts](src/jobs/validators/utils/get-churn-limit.ts)
- validator update stores fork-gated `exitChurnLimit`:
  - [src/jobs/validators/validators.service.ts](src/jobs/validators/validators.service.ts)
- waiting-time uses stored exit churn:
  - [src/waiting-time/waiting-time.service.ts](src/waiting-time/waiting-time.service.ts)
- fork epoch helper:
  - [src/common/spec/spec.service.ts](src/common/spec/spec.service.ts)

Relevant tests:
- [src/jobs/validators/utils/get-churn-limit.spec.ts](src/jobs/validators/utils/get-churn-limit.spec.ts)
- [src/waiting-time/waiting-time.service.spec.ts](src/waiting-time/waiting-time.service.spec.ts)
- [src/storage/validators/validators-cache.service.spec.ts](src/storage/validators/validators-cache.service.spec.ts)

## EIP-8080

**Declined for Inclusion in Glamsterdam** per Hardfork Meta [EIP-7773](https://eips.ethereum.org/EIPS/eip-7773).

The consolidation-queue exit-routing implementation was removed: modelling behavior the
chain will not have would shorten waiting-time estimates after the fork. The EIP-8061
churn split (`exitChurnLimit` / `consolidationChurnLimit`) stays — it is part of the fork.

If the EIP returns in a later fork, re-implement from its final pseudocode: the routing
replaces both the churn budget (`floor(3 × consolidationChurnLimit / 2)`) and the anchor
epoch, and the beacon-state queue tails (`earliest_exit_epoch` /
`earliest_consolidation_epoch`) must be clamped to
`compute_activation_exit_epoch(current_epoch)` before use — the raw fields go stale while
the queues are idle.
