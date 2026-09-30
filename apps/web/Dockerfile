FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml patches ./
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/validation packages/validation
COPY packages/api-client packages/api-client
COPY apps/web apps/web

RUN pnpm install --frozen-lockfile --filter @netram/web... --include-workspace-root

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
COPY --from=base /app /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @netram/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app /app
WORKDIR /app/apps/web

EXPOSE 3000
CMD ["pnpm", "start"]
