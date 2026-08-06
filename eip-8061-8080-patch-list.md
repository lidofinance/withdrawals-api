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

Detailed TODO moved here:
- [eip-8080-todo.md](eip-8080-todo.md)

Most relevant paragraphs in that file:
- [Scope](eip-8080-todo.md#scope)
- [Recommended App Strategy](eip-8080-todo.md#recommended-app-strategy)
- [Phase 1: Heuristic Support](eip-8080-todo.md#phase-1-heuristic-support)
- [Code Changes](eip-8080-todo.md#code-changes)
- [Tests](eip-8080-todo.md#tests)
- [Phase 2: More Exact Support](eip-8080-todo.md#phase-2-more-exact-support)
