## Withdrawals API

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Test

```bash
# unit tests
$ yarn test

# e2e tests
$ yarn test:e2e

# test coverage
$ yarn test:cov
```

## Release flow

To create a new release:

1. Merge all changes to the `main` branch.
1. After the merge, the `Prepare release draft` action will run automatically. When the action is complete, a release draft is created.
1. When you need to release, go to Repo → Releases.
1. Publish the desired release draft manually by clicking the edit button - this release is now the `Latest Published`.
1. After publication, the action to create a release bump will be triggered automatically.

## How calculation works
Requests are processed by Lido Accounting Oracle and finalized at time of report, when frame ends.
More about finalization process [here](https://docs.lido.fi/guides/oracle-spec/accounting-oracle#request-finalization)

Each withdrawal request finalizing by next sources of eth:

1. Buffer. [method](https://docs.lido.fi/contracts/lido#getbufferedether) from Lido Contract
2. Vault Balances. [WithdrawalVaults](https://docs.lido.fi/contracts/withdrawal-vault) and [ExecutionLayerRewardsVault](https://docs.lido.fi/contracts/lido-execution-layer-rewards-vault) are income potential income in the end of current frame.
3. Rewards. Calculation uses rewards from previous oracle report as approximate number of rewards per future frames.
4. Withdrawable Validators. If network already has some Lido validators with withdrawable epoch will consider them as potential income to buffer for frame of withdrawable epoch of validator + sweeping mean
5. Exit Validators. If previous sources of eth is not enough VEBO is going to exit Lido validators. This process is described [here](https://docs.lido.fi/guides/oracle-spec/validator-exit-bus/).

Note, the requests made close to end of frame are postponed to next frame because of limit [here](https://docs.lido.fi/contracts/oracle-report-sanity-checker#getoraclereportlimits).

## License

API Template is [MIT licensed](LICENSE).
