FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml patches ./
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/data packages/data
COPY services/realtime services/realtime
COPY db/seed db/seed

RUN pnpm install --frozen-lockfile --filter @netram/realtime --include-workspace-root

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app /app
WORKDIR /app/services/realtime

EXPOSE 80
CMD ["pnpm", "start"]