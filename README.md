## Withdrawals API

The Withdrawals API offers an utility for estimating the waiting time for [withdrawals](https://docs.lido.fi/guides/lido-tokens-integration-guide#withdrawals-unsteth) within the Lido protocol on Ethereum.

This service is helpful for stakers, providing insights from the moment of withdrawal request [placement](https://docs.lido.fi/contracts/withdrawal-queue-erc721#request) to its [finalization](https://docs.lido.fi/contracts/withdrawal-queue-erc721#finalization).

### Use Cases

- Estimation Before Request: Users can estimate the waiting time before placing a withdrawal request.
- Tracking: Users can track the estimated waiting time for an already placed request.

Detailed explanation of the estimation algorithm is available [here](how-estimation-works.md).

### Prerequisites

- Node.js (version 20.0 or higher)
- Yarn

### Installation

```bash
$ yarn install
```

### Configuration

```bash
# Edit the newly created `.env` file to populate with proper values.
$ cp sample.env .env
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

## License

Withdawals API is [MIT licensed](LICENSE).
