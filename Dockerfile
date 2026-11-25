ARG DHI_NODE_IMAGE=docker.io/lidofinance/dhi-node
ARG NODE_VERSION=24.22.3
ARG ALPINE_VERSION=3.24

ARG DHI_DEV_DIGEST=sha256:665a173e7d07f3707c68311c6722c91a4524eb7ffd09fe8f400f62fa12d81fd8
ARG DHI_RUNTIME_DIGEST=sha256:4544851709621aa77a18134101ef4cd6af39233cf57bdfe2adcc17e2e72866db

# Install from manifests and contract ABIs; ordinary source edits reuse this layer.
FROM ${DHI_NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION}-dev@${DHI_DEV_DIGEST} AS deps

WORKDIR /app

COPY package.json yarn.lock ./
COPY ./src/common/contracts/abi ./src/common/contracts/abi

RUN yarn install --frozen-lockfile --non-interactive \
    && yarn cache clean

# Production-only dependency tree for the final image.
# Independent of `deps`, so BuildKit can build both dependency stages in parallel.
FROM ${DHI_NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION}-dev@${DHI_DEV_DIGEST} AS prod-deps

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --non-interactive --production --ignore-scripts \
    && yarn cache clean

# Application build
FROM ${DHI_NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION}-dev@${DHI_DEV_DIGEST} AS building

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY ./tsconfig*.json ./
COPY ./src ./src
COPY --from=deps /app/src/common/contracts/generated ./src/common/contracts/generated

RUN yarn build

# Minimal DHI runtime image
FROM ${DHI_NODE_IMAGE}:${NODE_VERSION}-alpine${ALPINE_VERSION}@${DHI_RUNTIME_DIGEST}

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY --from=building /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY ./network-configs ./network-configs
COPY ./package.json ./
COPY ./build-info.json ./

# DHI runtime has no shell or wget.
# Keep for compatibility with legacy infrastructure.
# Remove after full K8s migration, as Kubernetes uses its own health probes.
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/health', { signal: AbortSignal.timeout(9000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# DHI runtime already runs as non-root (UID/GID 1000:1000).
CMD ["node", "dist/main"]
