FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config packages/config
COPY packages/types packages/types
COPY services/cctv-gateway services/cctv-gateway

RUN pnpm install --frozen-lockfile --filter @netram/cctv-gateway --include-workspace-root

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app /app
WORKDIR /app/services/cctv-gateway

EXPOSE 3003
CMD ["pnpm", "start"]
