# Glamsterdam Readiness Scope

Status checked against Plataberget / Glamsterdam Devnet-8 on 2026-09-03.

## Working branch

`feature/si-2499-wq-api-glamsterdam-hardfork-updates` (`#339`) is the canonical Glamsterdam branch. Rebase it onto current `develop` before merge.

## Done

- [x] **EIP-8061:** fork-gated exit/consolidation churn split and live CL-spec parameters with mainnet fallbacks.
- [x] **EIP-7732 / Gloas:** `GLOAS_FORK_EPOCH` detection and post-fork execution-payload envelope endpoint.
- [x] **EIP-7732 / Gloas:** payload-availability delay and `builder_pending_withdrawals` included in sweep ETA.
- [x] **EIP-8282:** include exited-builder withdrawals in `sweepMeanEpochs`.
- [x] Read `SLOTS_PER_EPOCH` from the CL spec and support `SLOT_DURATION_MS` when `SECONDS_PER_SLOT` is absent.
- [x] Remove **EIP-8080** code and todo: it was declined for Glamsterdam.

## To do

- [ ] Re-measure the two WithdrawalQueue request fallback gas limits after `EIP-2780`, `EIP-7708`, `EIP-7976`, `EIP-8037`, and `EIP-8038`.
  - Prerequisite: obtain Glamsterdam-devnet addresses for `WithdrawalQueue`, `stETH`, and `wstETH`, plus a funded account that can produce valid permits for both tokens.
  - Measure `requestWithdrawalsWithPermit` and `requestWithdrawalsWstETHWithPermit` with `requestCount` `1`, `2`, `16`, and `256` on a devnet running the final EL client set.
  - Record `eth_estimateGas` and confirm the boundary cases with successful transactions using the proposed limit.
  - For each method, choose a per-request constant that satisfies `fallback * requestCount >= measuredGas` for every successful scenario, with a safety margin.
  - Update `WITHDRAWAL_QUEUE_REQUEST_STETH_PERMIT_GAS_LIMIT_DEFAULT` and `WITHDRAWAL_QUEUE_REQUEST_WSTETH_PERMIT_GAS_LIMIT_DEFAULT` in `src/http/estimate/estimate.constants.ts`; no `EstimateService` behavior change is expected.
  - Record the devnet, EL client version, block number, inputs, measurements, and selected margin in the PR description.

## Out of scope

- [x] No application changes are required for the remaining Devnet-8 EL/P2P/opcode EIPs: `7610`, `7688`, `7778`, `7843`, `7928`, `7954`, `7975`, `7981`, `7997`, `8024`, `8045`, `8070`, `8136`, `8159`, `8189`, `8246`, `8261`.
