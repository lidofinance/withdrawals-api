## Understanding withdrawal waiting time estimation

### Introduction

This guide details the method used in the Withdrawals API service to estimate the time from when a withdrawal request is placed in the Lido protocol until it is finalized and becomes claimable.

By demystifying this process, the document is aimed to provide both users and developers with a clear understanding of the steps involved.

### The algorithm overview

The estimation of the withdrawal waiting time begins by identifying the applicable base case, based on the following conditions:

The algorithm estimates withdrawal waiting times by evaluating the current state and projecting future events.

1. Check if the `BUNKER` mode is active.
2. Determine if the `buffer` or `vaultsBalance` holds enough ether to cover withdrawal request (`totalBuffer` is enough).
3. Choose the soonest possible case for covering the withdrawal request, which could be:
   1. `rewardsOnly`: incorporating expected rewards from consensus layer (CL) and execution layer (EL).
   2. `validatorBalances`: leveraging balances from validators scheduled for withdrawal
   3. `exitValidators`: considering additional validator exits necessary to accumulate sufficient funds.

Regardless of the base case detected, every possible withdrawal request finalization still aligns with the [AccountingOracle](https://docs.lido.fi/contracts/accounting-oracle) report, occurring daily (with only rare exceptions), gathered for the exact reference slot (e.g., 12:00:04 UTC every day for Mainnet) happening with a submission delay about ~30 minutes (see the example [tx](https://etherscan.io/tx/0x569556dd4694408de8c8c0a164f4ace48273227c156b42969cd75034063f0907) for `AccountingOracle.submitReportData(...)`).

Therefore, the withdrawal time estimation is affected by the quantization of the time scale based on the projected oracle report timestamps.

### AccountingOracle report finalization quantization

The section provides an overview of the `AccountingOracle` key timings and margins.

#### Calculate next AccountingOracle report reference epoch

Since the withdrawal finalization happens together with the AccountingOracle report, the first step needed is to calculate the nearest (next) report reference epoch.

- calculation of epoch of the next frame of the `AccountingOracle` report:
  `epochOfNextReport = initialEpoch + nextFrame * epochsPerFrame`
- `initialEpoch` and `epochsPerFrame` are taken from the `HashConsensus` contract instance deployed for `AccountingOracle` via the [getFrameConfig](https://docs.lido.fi/contracts/hash-consensus#getframeconfig) method, the frame length is 1 day on Mainnet.

#### Finalization safe border before the next report

- Withdrawal requests which were placed too close to the upcoming report will be postponed further to the closest suitable report following the upcoming one
- The margin (i.e., finalization safe border) is defined inside the `OracleReportSanityChecker` contract and can be retrieved as `limits.requestTimestampMargin` from [getOracleReportLimits](https://docs.lido.fi/contracts/oracle-report-sanity-checker#getoraclereportlimits), the default value on Mainnet is 2 hours if the protocol is in the `TURBO` (i.e., not `BUNKER`) mode, see the following [thread](https://research.lido.fi/t/withdrawals-for-lido-on-ethereum-bunker-mode-design-and-implementation/3890/4).

### Report submission delay after the reference epoch arrival

- It usually takes 20-30 minutes to prepare the oracle report (mostly to wait when the reference epoch is finalized).
- However, in rare cases it's possible that the report won’t happen in the current reporting frame, though it's unlikely and happened only a few times since the moment of the Lido protocol launch.

## Base cases

### 1. [WIP] Case of the active `BUNKER` mode (unlikely)

The `BUNKER` mode is checked via the `WithdrawalQueueERC721` contract using the utility view method [here](https://docs.lido.fi/contracts/withdrawal-queue-erc721#isbunkermodeactive).

> In the `BUNKER` mode, a fixed finalization time of 14 frames is assumed unless affected by slashing events, reflecting a more conservative approach to claimable ether accessibility.

More about the `BUNKER` mode is [here](https://docs.lido.fi/guides/oracle-spec/accounting-oracle/#bunker-mode-activation).

### 2. Case if there is enough buffered ether (including withdrawals and EL rewards vaults balances)

If there is enough ether from the following sources to finalize all unfinalized requests placed before and included the provided one:

- buffer ether available for withdrawals: `Lido.getBufferedEther() - Lido.getDepositsReserve()` (the deposits reserve is a portion of the buffer protected for CL deposits; pre-SR-3 contracts have no such concept and the term is 0)
- ether balance of [WithdrawalVault](https://docs.lido.fi/contracts/withdrawal-vault)
- ether balance of [ExecutionLayerRewardsVault](https://docs.lido.fi/contracts/lido-execution-layer-rewards-vault)

i.e, `totalBuffer = (Lido.getBufferedEther() - depositsReserve) + balanceOf(WithdrawalVault) + balanceOf(ELRewardsVault)`

Then the finalization is possible relying on the already existing `totalBuffer` ether amount in the nearest oracle report (including the safe board and submission delay into consideration).

---

### 3.i. Case of the projected rewards

If there is not enough ether to fulfill the withdrawal request (`unfinalized > totalBuffer`), the next case is to consider projected rewards for the future report. In this case, the projected rewards amount can be approximately derived from the previous report.

The following formula is utilized to get epoch

`projectedRewardsPotentialEpoch = (unfinalized - totalBuffer) / rewardsPerEpoch`

where `unfinalized` is the amount of the withdrawal request considered summed with all of the unfinalized requests placed before.

--- we can consider this number as approximate future rewards

### 3.ii. Case of validators with withdrawable epoch

If there is not enough ether to fulfill the withdrawal request (`unfinalized > totalBuffer`), the previous case might be appended with the known validators are to be withdrawn (when the `withdrawable_epoch` is assigned).

It's needed to select the Lido-participating validators which are already in process of withdrawal and group them by calculated frame of expected withdrawal to `frameBalances`, allowing to find the oracle report frame containing enough funds from:

- buffer (`totalBuffer`)
- projectedRewards (`rewardsPerEpoch * epochsTillTheFrame`)
- frameBalances (`object { [frame]: [sum of balances of validators with calculated withdrawal frame] }`)

#### Algorithm of calculation withdrawal frame of validators:

1. Withdrawals sweep cursor goes from 0 to the last validator index in infinite loop.
2. When the cursor reaches a withdrawable validator, it withdraws ETH from that validator.
3. The cursor can withdraw from a maximum of 16 validators per slot.
4. We assume that all validators in network have to something to withdraw (partially or fully)
5. `percentOfActiveValidators` is used to exclude inactive validators from the queue, ensuring more accurate calculations.
6. Formula to get number of slots to wait is `(number of validators to withdraw before cursor get index of validator) / 16`
7. By knowing number slots we can calculate frame of withdrawal 

---

### 3.iii. Case when new validator exits are needed to finalize the withdrawal requests

- Drain rate per VEBO frame: `min(exitChurnPerEpoch * epochsPerFrameVEBO, maxBalanceExitRequestedPerReportInEth) + rewardsPerEpoch * epochsPerFrameVEBO`. The `min` term selects whichever is the binding constraint — network exit churn × frame duration, or the VEBO governance cap.
- VEBO frames needed: `unfinalizedStETH / drainRatePerVEBOFrame + 1`.
- `exitChurnPerEpoch` is the post-Electra balance-based churn from the consensus layer, see [Churn limit](#churn-limit).
- `maxBalanceExitRequestedPerReportInEth` is the per-VEBO-frame ETH cap from `OracleReportSanityChecker`. Setting it to 0 (governance pause) skips this case entirely.
- `rewardsPerEpoch` is calculated as described in the provided [prediction model](https://hackmd.io/@lido/r1fau3aJ3?type=view#Predict-available-ETH-before-next-withdrawn).
- Exited validators become withdrawable only after the withdrawal [sweep](#sweeping-mean) approaches them.

### Rewards available for withdrawals

Post-SR-3, governance sets a `depositsReserveTarget` that the Lido contract refills the deposits reserve to at every oracle report. The per-frame rewards rate used in projection formulas (cases 3.i, 3.ii, 3.iii) is therefore net of this claim:

`rewardsAvailableForWithdrawals = rewardsPerFrame - min(target, rewardsPerFrame)`

Conservative — assumes worst case where the reserve fully drains between reports. When `target = 0` (governance hasn't set one), this is a no-op. Source: `Lido.getDepositsReserveTarget()`.

### Churn limit

Post-Electra exit churn is balance-based: protocol caps it at `[128, 256]` ETH/epoch with the dynamic value being `totalActiveBalance / 2^16` (gwei). wq-api computes this in the validators job from `totalActiveBalance` and exposes it as a 32-ETH-equivalent count for downstream formulas; multiplying back by `MIN_ACTIVATION_BALANCE` is a unit identity that yields ETH/epoch.

### Sweeping Mean
For simplicity, it's suggested to use the average time of the withdrawal sweep (`sweepingMean`) as a constant timeframe extension when estimating the withdrawal waiting time.

Post-Electra, EL-triggered partial withdrawals consume up to 8 of 16 withdrawal slots per block (`MAX_PENDING_PARTIALS_PER_WITHDRAWALS_SWEEP = 8`), which can slow the sweep cursor by up to 50%. wq-api accounts for this via `blockedByDeferredSlots` in the per-validator timestamp projection.

More information can be found [here](https://consensys.net/shanghai-capella-upgrade/) in *Full Withdrawal Process* chapter*.*

> it is takes 256 epoch (27.3 hours) at minimum on Mainnet, and the current avg value is 567 epochs (the values depend on the total validators number).


---

### Conclusion

This guide aims to offer a comprehensive understanding of the factors influencing the estimation of withdrawal request finalization times within the Lido protocol. For further details and updates, refer to the links provided in the References section.

### References

- [Withdrawals: Lido tokens integration guide](https://docs.lido.fi/guides/lido-tokens-integration-guide#withdrawals-unsteth)
- [AccountingOracle: withdrawals stage](https://docs.lido.fi/guides/oracle-spec/accounting-oracle#withdrawal-stage)
- [ValidatorExitBus specification](https://docs.lido.fi/guides/oracle-spec/validator-exit-bus)
- [Just how fast are Ethereum withdrawals using the Lido protocol](https://blog.lido.fi/just-how-fast-are-ethereum-withdrawals-using-the-lido-protocol/)
- [Lido Withdrawal Queue Stats: Dune dashboard](https://dune.com/lido/lido-v2)
