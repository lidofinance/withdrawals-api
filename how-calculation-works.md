## How calculation works

Requests are processed by Lido Accounting Oracle and finalized at time of report, when frame ends.
More about finalization process [here](https://docs.lido.fi/guides/oracle-spec/accounting-oracle#request-finalization)

Each withdrawal request finalizing by next sources of eth:

1. Buffer. It is [method](https://docs.lido.fi/contracts/lido#getbufferedether) from Lido Contract
2. Vault Balances. [WithdrawalVaults](https://docs.lido.fi/contracts/withdrawal-vault) and [ExecutionLayerRewardsVault](https://docs.lido.fi/contracts/lido-execution-layer-rewards-vault) are potential income in the end of current frame.
3. Rewards. Calculation uses rewards from previous oracle report as approximate number of rewards per future frames.
4. Withdrawable Validators. If network has Lido validators with withdrawable epoch they will be considered as potential income to buffer for frame of withdrawable epoch of validator + sweeping mean
5. Exit Validators. If previous sources of eth is not enough Validator Exit Bus Oracle is going to exit Lido validators to accumulate necessary amount eth. This process is described [here](https://docs.lido.fi/guides/oracle-spec/validator-exit-bus/).

Note, the requests made close to end of frame are postponed to next frame because of limit [here](https://docs.lido.fi/contracts/oracle-report-sanity-checker#getoraclereportlimits).
