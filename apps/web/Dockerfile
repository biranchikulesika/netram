FROM docker.io/library/node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Explicit destination per directory: `COPY dir ./` flattens `dir`'s contents
# under Buildah/podman, which breaks the pnpm workspace layout.
COPY patches ./patches
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/validation ./packages/validation
COPY packages/api-client ./packages/api-client
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile --filter @netram/web... --include-workspace-root

FROM docker.io/library/node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
COPY --from=base /app /app
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time client configuration.
#
# Server Components that call loadClientEnv() (e.g. app/page.tsx) are executed
# during `next build` to prerender static pages. loadClientEnv() validates the
# client env schema, and NEXT_PUBLIC_API_URL has no schema default, so the
# build aborts unless the value is present in the builder stage.
#
# These are PUBLIC values (origin, WebSocket URL, auth provider signal). They
# carry no secret. At runtime the values actually used come from the web
# container's own environment, which is the authoritative source; these only
# have to be present and valid to let prerendering succeed.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_REALTIME_WS_URL
ARG NETRAM_AUTH_PROVIDER
ARG NETRAM_MEDIAMTX_WHEP_URL
ARG NETRAM_MEDIAMTX_WHEP_USERNAME
ARG NETRAM_MEDIAMTX_WHEP_PASSWORD
ARG NETRAM_MEDIAMTX_HLS_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_REALTIME_WS_URL=${NEXT_PUBLIC_REALTIME_WS_URL} \
    NETRAM_AUTH_PROVIDER=${NETRAM_AUTH_PROVIDER} \
    NETRAM_MEDIAMTX_WHEP_URL=${NETRAM_MEDIAMTX_WHEP_URL} \
    NETRAM_MEDIAMTX_WHEP_USERNAME=${NETRAM_MEDIAMTX_WHEP_USERNAME} \
    NETRAM_MEDIAMTX_WHEP_PASSWORD=${NETRAM_MEDIAMTX_WHEP_PASSWORD} \
    NETRAM_MEDIAMTX_HLS_URL=${NETRAM_MEDIAMTX_HLS_URL}

RUN pnpm --filter @netram/web build

FROM docker.io/library/node:22-alpine AS runner
# `corepack enable` is required here: it installs the pnpm shim into the node
# prefix (outside /app), so copying /app from the builder does NOT bring it.
# Without this, CMD ["pnpm", "start"] fails with
# "Cannot find module /app/apps/web/pnpm".
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app /app
WORKDIR /app/apps/web

EXPOSE 3000
CMD ["pnpm", "start"]
