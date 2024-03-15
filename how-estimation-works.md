## Understanding withdrawal waiting time estimation

### Introduction

The document elucidates the algorithm behind estimating the waiting time involved from placing a withdrawal request to its finalization, helping users and developers grasp the underlying processes.

### The algorithm explained

The estimation of the withdrawal waiting time begins by identifying the first suitable calculation case, based on the following conditions:

1. checks if the `bunker` mode is active.
2. determines if the `buffer` or `vaultsBalance` has possess enough funds to cover withdrawal request.
3. selects the minimum frame from the following three cases of `rewardOnly`, `validatorBalances` or `exitValidators`.

The finalization of requests aligns with the [AccountingOracle](https://docs.lido.fi/contracts/accounting-oracle) report, occurring at exact reference slots across different networks (e.g., 12:00:04 UTC for Mainnet).

### Calculate next report time

- calculation of epoch of next frame of report:
  `epochOfNextReport = initialEpoch + nextFrame * epochsPerFrame`
- `initialEpoch` and `epochsPerFrame` are from `accountingOracleHashConsensus` contract [getFrameConfig](https://docs.lido.fi/contracts/hash-consensus#getframeconfig) method

### Gap before next report

- Withdrawal requests which are close to report (`getRequestTimestampMargin`) will not be in closest report, will be postponed to the next one if they are in that gap before report.
- `OracleReportSanityChecker` contract, get `limits.requestTimestampMargin` from [getOracleReportLimits](https://docs.lido.fi/contracts/oracle-report-sanity-checker#getoraclereportlimits)

### Gap after report

- it takes time to proceed report it usually it can take 20-30 min. But in emergency cases there is possibility that report won’t happen in current frame, but possibility is very low and it happened only around 5 time in history.

## More about each calculation case

### Case if there is enough tokens in buffer + withdrawals vaults for withdrawal:

If next sources of tokens has enough funds for current request + all others unfinalized requests before this request, we can withdraw tokens without exit validators process.

- lido buffer from [method](https://docs.lido.fi/contracts/lido#getbufferedether)
- balance of [WithdrawalVaults](https://docs.lido.fi/contracts/withdrawal-vault) and [ExecutionLayerRewardsVault](https://docs.lido.fi/contracts/lido-execution-layer-rewards-vault)

---

### Case of rewards only

Based on rewards from previous report we can consider this number as approximate future rewards. Formula to get epoch

`onlyRewardPotentialEpoch = unfinalized / rewardsPerEpoch`

where `unfinalized` is current request + all requests before it.

---

### Case of validators with withdrawable epoch

We can find Lido validators which is already in process of withdrawal and group them by `withdrawable_epoch` to `frameBalances`, then we can find frame and return it.

---

### Case if there is NOT enough tokens for withdrawal:

- We are going to calculate how much reports should be proceeded to fulfil current withdrawal
- Basic target is to find epoch for exit all needed validators
- Find epoch by this formula: `unfinalizedStethe / (32eth * churnLimit + rewardsPerEpoch)`
- `rewardsPerEpoch` calculation can be found [here](https://hackmd.io/@lido/r1fau3aJ3?type=view#Predict-available-ETH-before-next-withdrawn)
- And last thing to count is `sweepingMean`.  More information can be found [here](https://consensys.net/shanghai-capella-upgrade/) in *Full Withdrawal Process* chapter*.* Shortly it is minimum 256 epoch (27.3 hour). But we use middle value which is 567 epoch (depending on total validators number). **
- Next find next frame after found epoch potential epoch
- No gap before report but gap after report still exists

---

### [Under construction] Case of bunker active

We check if bunker is active in contract [here](https://docs.lido.fi/contracts/withdrawal-queue-erc721#isbunkermodeactive) and predict that finalization will be in approximately 14 frames as constant if there are no associated slashings. More about bunker more [here](https://docs.lido.fi/guides/oracle-spec/accounting-oracle/#bunker-mode-activation).


### References

- [Withdrawals: Lido tokens integration guide](https://docs.lido.fi/guides/lido-tokens-integration-guide#withdrawals-unsteth)
- [AccountingOracle: withdrawals stage](https://docs.lido.fi/guides/oracle-spec/accounting-oracle#withdrawal-stage)
- [ValidatorExitBus specification](https://docs.lido.fi/guides/oracle-spec/validator-exit-bus)
- [Just how fast are Ethereum withdrawals using the Lido protocol](https://blog.lido.fi/just-how-fast-are-ethereum-withdrawals-using-the-lido-protocol/)
- [Lido Withdrawal Queue Stats: Dune dashboard](https://dune.com/lido/lido-v2)
