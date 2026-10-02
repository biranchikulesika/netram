FROM docker.io/library/node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

# Install production dependencies first (better layer caching).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Directory sources need an explicit destination directory. `COPY dir ./`
# (Docker shorthand) is interpreted by Buildah/podman as "the CONTENTS of dir",
# which flattens the workspace and breaks the pnpm workspace layout.
COPY patches ./patches
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/validation ./packages/validation
COPY packages/data ./packages/data
COPY services/api ./services/api
COPY db/seed ./db/seed

# The trailing `...` is required: it installs the package AND its workspace
# dependency graph. Without it, @netram/data is symlinked but its own
# dependencies (postgres, drizzle-orm, ...) are absent, and `pnpm db:setup`
# and the API itself fail at import time.
# @netram/seed is included because this image also runs migrations plus the
# deterministic seed (`pnpm db:setup`), and the seed has its own dependencies
# (uuid, zod) that no other filter pulls in.
RUN pnpm install --frozen-lockfile --filter @netram/api... --filter @netram/seed... --include-workspace-root

# Migrations travel with the image so the demo stack's scheduled db-reset job
# (and any one-shot `db-migrate` run) can rebuild the schema from zero.
COPY db/migrations ./db/migrations

FROM docker.io/library/node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app /app
WORKDIR /app/services/api

EXPOSE 80

# Default: run the API. Other entrypoints used by compose:
#   pnpm workers        - background job workers (workers service)
#   pnpm db:migrate     - apply pending migrations (one-shot)
#   pnpm db:setup       - reset schema from zero + deterministic seed
#                         (demo reset job; requires NETRAM_ALLOW_DB_RESET=1
#                         on non-local databases)
CMD ["pnpm", "start"]
