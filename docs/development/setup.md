# Development

Setup, database lifecycle, service startup, and verification. For team
ownership and parallel-work rules see [`../OWNERSHIP.md`](../OWNERSHIP.md) and
AGENTS.md (§68 branching, §61–62 ownership). Environment matrix and isolation
rules: [`environments.md`](environments.md). Deployment status:
[`../deployment.md`](../deployment.md).

## Requirements

- Node ≥ 22, pnpm 12, Docker.

## First-time setup

```bash
git clone <repo> && cd netram
pnpm install
cp .env.example .env     # fill DATABASE_URL etc. (compose defaults work locally)
pnpm infra:up            # Postgres + Redis + MinIO
pnpm db:setup            # migrate from zero + deterministic seed
```

`pnpm db:setup` = `db:reset` (drop + migrate from zero) + `db:seed`
(deterministic synthetic seed, idempotent). Migrations + seed are the source
of truth — never hand-edit the local DB and call it done (AGENTS.md §11–13).

## Running services

```bash
pnpm --filter @netram/api dev        # REST API       :3001
pnpm --filter @netram/realtime dev   # realtime WS    :3002
pnpm --filter @netram/web dev        # web            :3000
pnpm --filter @netram/cctv-gateway dev # CCTV gateway :3003
pnpm --filter @netram/api workers    # background worker pool
```

AI service (Python): `cd services/ai && pip install -e . && uvicorn app.main:app --port 8000`
(see `services/ai/pyproject.toml`).

### Inspector mobile app

```bash
pnpm --filter @netram/inspector-mobile start     # Expo dev server (then press a / i / w)
pnpm --filter @netram/inspector-mobile android  # Android emulator
pnpm --filter @netram/inspector-mobile ios      # iOS simulator
pnpm --filter @netram/inspector-mobile web      # browser
```

From `apps/inspector-mobile` the same scripts are `pnpm start`, `pnpm android`,
`pnpm ios`, `pnpm web`. The API on `:3001` must be running for online sync,
evidence upload and login; queued offline operations are flushed on reconnect.

### CCTV media rig

The full simulated facility (camera → RTSP → MediaMTX):

```bash
pnpm run cctv:up   # netram-media + camera-sim + facility-nvr
```

Without this rig, camera feeds fail with `503` from the stream endpoint and
`{"status":"unavailable","mediamtx":"unreachable"}` on `GET :3003/media/health`.
Check that health endpoint first when a feed fails.

Then watch a seeded rig camera in the Control Room, or `/dev/cctv-test` for
debugging. Details: [`../architecture/cctv.md`](../architecture/cctv.md) §10.

## Environment variables

Centralised + validated in `packages/config/src/env/` (Zod). `NEXT_PUBLIC_*`
keys are client-safe; everything else is server-only. `.env.example` is the
full documented list — notable entries:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis for jobs/outbox |
| `NETRAM_DEV_AUTH_SECRET` | Signing secret for dev-auth only |
| `NETRAM_API_PORT` (3001) / `NETRAM_API_URL` | API port / internal base URL |
| `NETRAM_REALTIME_PORT` (3002) / `NETRAM_REALTIME_URL` | Realtime port / base URL |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_REALTIME_WS_URL` | Public base URLs for web/mobile |
| `NETRAM_CCTV_*`, `NETRAM_MEDIAMTX_*` | CCTV gateway + MediaMTX endpoints, secrets, public WHEP URL |

Every new variable must be added to the config schema and `.env.example`, and
marked server-only when it is a secret.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm check:architecture && pnpm check:security
```

CI (`.github/workflows/ci.yml`) runs exactly these plus a fresh-database
`pnpm db:setup`, OpenAPI reproducibility (`pnpm api:export-openapi` must
produce no diff), pytest for `services/ai`, and a mobile runtime smoke test.

## Runtime verification

Start the stack (infra + api + web + realtime + cctv-gateway + workers) with a
seeded local DB, then run targeted full-stack checks:

```bash
pnpm verify:runtime:web            # SSR pages, evidence capture/upload/integrity, CCTV, VC, realtime
pnpm verify:runtime:cctv           # camera access authorization + jurisdiction boundaries
pnpm verify:runtime:evidence       # evidence capture-hash + integrity workflow
pnpm verify:runtime:workers        # outbox → BullMQ → notification worker (stop workers first)
pnpm verify:runtime:mobile         # offline sync simulation (no emulator needed)
```

CCTV streaming suites (see [`../architecture/cctv.md`](../architecture/cctv.md)):

```bash
pnpm verify:runtime:cctv-phase2    # media rig + browser playback (dev page)
pnpm verify:runtime:cctv-phase3    # gateway control bridge + fan-out
pnpm verify:runtime:cctv-phase4    # session lifecycle + external auth hook
pnpm verify:runtime:cctv-phase5    # Control Room playback + correlation + HLS
pnpm measure:cctv-latency          # receiver-side latency decomposition
```

`verify:runtime:workers` re-runs the outbox dispatcher directly; stop
`pnpm --filter @netram/api workers` before running it.

## Working in parallel

Ownership per area: [`../OWNERSHIP.md`](../OWNERSHIP.md) (enforced by
`.github/CODEOWNERS`). Branching is strictly
`feature/* → develop → preview → production` via PR + squash
(AGENTS.md §68) — never commit directly to integration branches. Shared
contract changes (`packages/types`, `packages/validation`, `packages/api-client`,
`packages/config`) need owner review and consumer updates in the same change
(AGENTS.md §19).
