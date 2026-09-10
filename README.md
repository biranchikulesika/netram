# Netram

Smart real-time monitoring & inspection platform for the Department of Social
Justice & Empowerment (DoSJE). Netram gives authorities a single, accountable
window into government-funded institutions: live project monitoring, structured
inspections, complaint oversight, CCTV integration and AI-assisted anomaly
review.

> **AI is advice, not authority.** No model output declares fraud or modifies
> official truth; every signal remains reviewable information routed through
> the normal human workflow (see `services/ai`, AGENTS.md §36).

## Architecture

A modular monolith backend with dedicated services only where the boundary is
justified by real constraints:

```
apps/web · apps/inspector-mobile         → typed clients (packages/api-client)
services/api · realtime · ai · cctv-gateway
packages/{types,validation,data,api-client,ui,config}
PostgreSQL (via Drizzle, only inside packages/data)
```

Canonical documents:

- `AGENTS.md` — engineering operating manual (authority, boundaries, rules)
- `docs/development/TEAM-HANDOFF.md` — how the team works in parallel (work areas, contracts, task backlog)
- `docs/` — architecture, domain, contracts, decisions, development

## Development

Requirements: Node ≥ 22, pnpm 12, Docker.

```bash
cp .env.example .env          # fill DATABASE_URL etc.
pnpm install
pnpm infra:up                 # Postgres + Redis + MinIO via Docker
pnpm db:setup                 # migrate from zero + deterministic seed
pnpm --filter @netram/api dev # API on :3000 (see packages/config)
```

| Command                                                     | Purpose                                        |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `pnpm db:reset` / `db:migrate` / `db:seed`                  | Database lifecycle                             |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` | Workspace checks                               |
| `pnpm check:architecture` · `pnpm check:security`           | Mechanical architecture guards / secret scan   |
| `pnpm api:export-openapi`                                   | Regenerate `services/api/openapi/openapi.json` |
| `pnpm infra:up` / `infra:down`                              | Local infrastructure                           |

### Verified vertical slice

The seed + API + realtime + web slice is runnable end-to-end today:

```
dev-login → /auth/me (permissions) → projects list/create/transition
  (server-enforced permission + jurisdiction + lifecycle rules)
outbox → realtime poller → hub → WebSocket delivery (authorized topics)
```

## Repository layout

- `apps/web` — Next.js web platform (Server Components default)
- `apps/inspector-mobile` — Expo app, offline-first inspection workflows
- `services/api` — modular monolith REST API (`/api/v1`)
- `services/realtime` — authorized event delivery (outbox → WS; never truth)
- `services/ai` — advisory anomaly detection
- `services/cctv-gateway` — provider-abstracted stream delivery, no raw credentials to clients
- `packages/data` — the only place Drizzle/Postgres live (repository pattern)
- `packages/types|validation|api-client|config|ui` — shared contracts
- `supabase/` — migrations + deterministic seed

## Security rules you inherit

- Server is authoritative for authZ, jurisdiction, workflows, disclosure.
- Never send what the user may not see (§34). Never leak DB/provider errors (§18).
- Secrets stay out of the repo (§22); the security scan enforces the high-signal cases.
- Tests must cover the failure paths: unauthorized, wrong jurisdiction,
  invalid transition, duplicate offline op, evidence-integrity failure (§49).

See `docs/development/` and `AGENTS.md` for the full operating manual.
