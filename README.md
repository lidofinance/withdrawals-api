## Withdrawals API

<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 12px;">
    <img alt="Withdrawals API Logo" src="./static/img/logo.jpg" />
</div>

The **Withdrawals API** service offers an utility for estimating the waiting time for [withdrawals](https://docs.lido.fi/guides/lido-tokens-integration-guide#withdrawals-unsteth) within the Lido protocol on Ethereum.

The service is helpful for stakers, providing insights from the moment of withdrawal request [placement](https://docs.lido.fi/contracts/withdrawal-queue-erc721#request) to its [finalization](https://docs.lido.fi/contracts/withdrawal-queue-erc721#finalization) when the request becomes claimable.

### Use Cases

- Estimation before request: users can estimate the waiting time before placing a withdrawal request.
- Tracking the existing request: users can track the estimated waiting time for the already placed request.

ℹ️ See also the [detailed explanation](how-estimation-works.md) of the estimation algorithm.

### Prerequisites

- Node.js (version 20.0 or higher)
- Yarn (version 1.22 or higher)

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
$ yarn build
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
