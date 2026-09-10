FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

# Install production dependencies first (better layer caching).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/validation packages/validation
COPY packages/data packages/data
COPY services/api services/api
COPY supabase/seed supabase/seed

RUN pnpm install --frozen-lockfile --filter @netram/api --include-workspace-root

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app /app
WORKDIR /app/services/api

EXPOSE 80
CMD ["pnpm", "start"]