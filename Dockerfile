ARG ALPINE_VERSION=3.24

FROM node:24-alpine${ALPINE_VERSION} AS building

WORKDIR /app

COPY package.json yarn.lock ./
COPY ./tsconfig*.json ./
COPY ./src ./src

RUN yarn install --frozen-lockfile --non-interactive && \
    yarn cache clean && \
    yarn build


FROM alpine:${ALPINE_VERSION}

WORKDIR /app

RUN apk add --no-cache libstdc++=15.2.0-r5 \
  && addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node

COPY --from=building /usr/local/bin/node /usr/local/bin/node
COPY --from=building /app/dist ./dist
COPY --from=building /app/node_modules ./node_modules

COPY ./network-configs ./network-configs
COPY ./package.json ./
COPY ./build-info.json ./

USER node

ENV NODE_OPTIONS="--max-old-space-size=4096"

HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD sh -c "wget -nv -t1 --spider http://localhost:$PORT/health" || exit 1

CMD ["node", "dist/main"]
