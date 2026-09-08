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

## Docker build

```bash
docker build -t withdrawals-api .
```

Dependency stages copy manifests and contract ABIs before installation so the existing
TypeChain `postinstall` runs normally. The build stage copies generated contracts from
`deps` and compiles the app. The final image uses a separate production-only dependency
tree. Ordinary source edits reuse the install layers; manifest or ABI changes rebuild them.

## Health probes

`GET /livez` returns 200 with `status: "ok"` and process uptime in seconds once the HTTP server is listening. It makes no
dependency calls and bypasses caching, rate limiting, and maintenance mode.

`GET /health` checks memory and live EL/CL block freshness. Provider failures or stale
blocks return 503 because the main API endpoints depend on EL/CL. The probe bypasses
rate limiting. Provider checks intentionally remain part of readiness.

The route list in `src/http/common/cache/http-cache.interceptor.ts` excludes `/health`,
`/livez`, and `/metrics` from server caching. Their handlers set `Cache-Control: no-store`.

This repository contains no Kubernetes deployment manifests. Configure the container's
probes with the application's `PORT` value (shown below as `<app-port>`):

```yaml
livenessProbe:
  httpGet:
    path: /livez
    port: <app-port>
readinessProbe:
  httpGet:
    path: /health
    port: <app-port>
```

The Docker `HEALTHCHECK` is separate and does not configure Kubernetes probes.

## Outgoing API metrics

Keys API calls emit `withdrawals_api_outgoing_api_requests_total` and
`withdrawals_api_outgoing_api_request_duration_seconds` with `target="lido-keys-api"`
and `status` labels. Status is the HTTP code, or `network_error` when no response is
received. Duration includes body decoding; decoding failures retain the received HTTP status.

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
