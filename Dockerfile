ARG ALPINE_VERSION=3.24

# Install from manifests and contract ABIs; ordinary source edits reuse this layer.
FROM node:24-alpine${ALPINE_VERSION} AS deps

WORKDIR /app

COPY package.json yarn.lock ./
COPY ./src/common/contracts/abi ./src/common/contracts/abi

RUN yarn install --frozen-lockfile --non-interactive \
    && yarn cache clean

# Production install also needs ABIs for the existing postinstall hook.
FROM node:24-alpine${ALPINE_VERSION} AS prod-deps

WORKDIR /app

COPY package.json yarn.lock ./
COPY ./src/common/contracts/abi ./src/common/contracts/abi

RUN yarn install --frozen-lockfile --non-interactive --production \
    && yarn cache clean

FROM node:24-alpine${ALPINE_VERSION} AS building

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY ./tsconfig*.json ./
COPY ./src ./src
COPY --from=deps /app/src/common/contracts/generated ./src/common/contracts/generated

RUN yarn build


FROM alpine:${ALPINE_VERSION}

WORKDIR /app

RUN apk add --no-cache libstdc++=15.2.0-r5 \
  && addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node

COPY --from=building /usr/local/bin/node /usr/local/bin/node
COPY --from=building /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules

COPY ./network-configs ./network-configs
COPY ./package.json ./
COPY ./build-info.json ./

USER node

ENV NODE_OPTIONS="--max-old-space-size=4096"

HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD sh -c "wget -nv -t1 --spider http://localhost:$PORT/health" || exit 1

CMD ["node", "dist/main"]
