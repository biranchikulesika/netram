# Development

New to the repo? Start with [TEAM-HANDOFF.md](./TEAM-HANDOFF.md) and
[WORK-AREAS.md](./WORK-AREAS.md). Shared contract changes follow
[SHARED-CONTRACTS.md](./SHARED-CONTRACTS.md). The current task backlog lives
in [TEAM-TASKS.md](./TEAM-TASKS.md).

## Requirements

- Node ≥ 22, pnpm 12, Docker.
- Clone → `cp .env.example .env` → set `DATABASE_URL` (see compose).

## Environment variables

Centralized + validated in `packages/config/src/env/`. `NEXT_PUBLIC_*` keys are
client-safe; everything else is server-only.

| Variable                              | Loaded by                           | Purpose                          |
| ------------------------------------- | ----------------------------------- | -------------------------------- |
| `DATABASE_URL`                        | `loadServerEnv`                     | Postgres connection string       |
| `REDIS_URL`                           | `loadServerEnv` / worker / realtime | Redis for jobs/outbox            |
| `NETRAM_DEV_AUTH_SECRET`              | `loadServerEnv`                     | Signing secret for dev-auth only |
| `NETRAM_API_PORT` (default 3001)      | `loadServerEnv`                     | API port                         |
| `NETRAM_API_URL` (default 3001)       | `loadServerEnv` / realtime          | Internal API base URL            |
| `NETRAM_REALTIME_PORT` (default 3002) | `loadRealtimeEnv`                   | Realtime WS port                 |
| `NETRAM_REALTIME_URL` (default 3002)  | `loadServerEnv`                     | Realtime base URL                |
| `NEXT_PUBLIC_API_URL`                 | `loadClientEnv`                     | Public API base for web/mobile   |
| `NEXT_PUBLIC_REALTIME_WS_URL` (default ws://localhost:3002) | `loadClientEnv` | Public WS URL for browsers |

Every new variable must be added to the schema, documented in `.env.example`,
and marked server-only when it is a secret.

## Database lifecycle (AGENTS.md §11–13)

```
pnpm infra:up        # Postgres + Redis + MinIO
pnpm db:reset        # drop + migrate from zero
pnpm db:seed         # deterministic synthetic seed (idempotent)
pnpm db:migrate      # apply pending migrations
```

Never reset production. Migrations + deterministic seed are the source of
truth — never hand-edit the local DB and call it done.

## Verify a vertical slice

```bash
pnpm --filter @netram/api dev      # API
pnpm --filter @netram/realtime dev # realtime (needs NETRAM_API_URL)
pnpm --filter @netram/web dev      # web
```

Then: dev-login → `/auth/me` → list/create/transition projects (validate 403 on
missing permission, 404 across jurisdiction, 409 on invalid transitions) →
subscribe the realtime socket on an authorized topic → mutate state → observe
the outbox-driven event.

## Runtime verification scripts (AGENTS.md §76)

Start the stack (`pnpm infra:up`, API, realtime, web, cctv-gateway, workers)
then run a targeted full-stack check against a seeded local DB:

```bash
pnpm verify:runtime:web       # SSR pages, evidence capture/upload/integrity, CCTV, VC, realtime
pnpm verify:runtime:cctv      # camera access authorization + jurisdiction boundaries
pnpm verify:runtime:evidence  # evidence capture-hash + integrity workflow
pnpm verify:runtime:workers   # outbox → BullMQ → notification worker (stop workers first)
pnpm verify:runtime:mobile    # offline sync simulation (requires mobile dev env)
```

`verify:runtime:workers` re-runs the outbox dispatcher directly; a concurrently
running worker pool consumes the BullMQ jobs it asserts on, so stop
`pnpm --filter @netram/api workers` before running it.

## Checks (run before finishing a change)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm check:architecture && pnpm check:security
```

See `AGENTS.md` §74 for what "done" actually means.
