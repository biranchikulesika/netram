FROM docker.io/library/node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Explicit destination per directory: `COPY dir ./` flattens `dir`'s contents
# under Buildah/podman, which breaks the pnpm workspace layout.
COPY patches ./patches
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/data ./packages/data
COPY services/realtime ./services/realtime
COPY db/seed ./db/seed

# Trailing `...` installs the workspace dependency graph too - see the note in
# services/api/Dockerfile. @netram/data's own dependencies are required here.
RUN pnpm install --frozen-lockfile --filter @netram/realtime... --include-workspace-root

FROM docker.io/library/node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app /app
WORKDIR /app/services/realtime

EXPOSE 80
CMD ["pnpm", "start"]