FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

# Install production dependencies first (better layer caching).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml patches ./
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/validation packages/validation
COPY packages/data packages/data
COPY services/api services/api
COPY db/seed db/seed

RUN pnpm install --frozen-lockfile --filter @netram/api --include-workspace-root

# Migrations travel with the image so the demo stack's scheduled db-reset job
# (and any one-shot `db-migrate` run) can rebuild the schema from zero.
COPY db/migrations db/migrations

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app /app
WORKDIR /app/services/api

EXPOSE 80

# Default: run the API. Other entrypoints used by compose:
#   pnpm workers        — background job workers (workers service)
#   pnpm db:migrate     — apply pending migrations (one-shot)
#   pnpm db:setup       — reset schema from zero + deterministic seed
#                         (demo reset job; requires NETRAM_ALLOW_DB_RESET=1
#                         on non-local databases)
CMD ["pnpm", "start"]
