# Netram

Smart real-time monitoring & inspection platform for the Department of Social
Justice & Empowerment (DoSJE), Government of India (Smart India Hackathon
problem statement SIH26095). Netram gives authorities a single, accountable
window into government-funded institutions: live project monitoring,
structured inspections, complaint oversight, CCTV integration and AI-assisted
anomaly review.

> **AI is advice, not authority.** No model output declares fraud or modifies
> official truth; every signal remains reviewable information routed through
> the normal human workflow (AGENTS.md §36).

## What is implemented

- **Core platform** — modular-monolith REST API (`/api/v1`) with
  server-authoritative authorisation, jurisdiction scoping, project lifecycle,
  inspections → findings → corrective actions (ATR flow), evidence integrity,
  complaints, notifications, audit trail, outbox events, background workers.
- **Web platform** — Next.js app: workspaces, registry, control room, admin.
- **Inspector mobile app** — Expo/React Native with offline operation queue.
- **Realtime** — outbox-driven authorised WebSocket delivery (delivery only,
  never truth).
- **CCTV live streaming** — Camera → RTSP → MediaMTX → WebRTC/HLS → browser
  with a control-plane gateway, session lifecycle, tokens, and external auth
  ([`docs/architecture/cctv.md`](docs/architecture/cctv.md)). Production
  facility deployment (WireGuard, real cameras, TLS) is **not** implemented
  yet — see [`docs/deployment.md`](docs/deployment.md).
- **AI service** — small advisory Python service (anomaly scoring shape);
  anomaly review lifecycle lives in the API.

## Repository layout

| Path                                                    | Purpose                                              |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `apps/web`                                              | Next.js web platform (Server Components default)     |
| `apps/inspector-mobile`                                 | Expo app, offline-first inspection workflows         |
| `services/api`                                          | Modular monolith REST API (`/api/v1`)                |
| `services/realtime`                                     | Authorised event delivery (outbox → WS; never truth) |
| `services/ai`                                           | Advisory anomaly detection (Python/FastAPI)          |
| `services/cctv-gateway`                                 | CCTV media control plane (no media bytes)            |
| `packages/{types,validation,api-client,data,ui,config}` | Shared contracts, persistence, config                |
| `supabase/`                                             | Migrations + deterministic seed                      |
| `infra/`                                                | MediaMTX + facility-sim configuration                |
| `scripts/`                                              | Architecture/security guards + runtime verifiers     |

## Development

Requirements: Node ≥ 22, pnpm 12, Docker.

```bash
cp .env.example .env          # fill DATABASE_URL etc.
pnpm install
pnpm infra:up                 # Postgres + Redis + MinIO via Docker
pnpm db:setup                 # migrate from zero + deterministic seed
pnpm --filter @netram/api dev # API on :3001
pnpm --filter @netram/web dev # web on :3000
pnpm --filter @netram/inspector-mobile start # Expo dev server (a = Android, i = iOS, w = web)
```

Full setup, database lifecycle, verification scripts and the CCTV media rig:
[`docs/development/setup.md`](docs/development/setup.md).

| Command                                                 | Purpose                                              |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm db:setup` / `db:reset` / `db:migrate` / `db:seed` | Database lifecycle                                   |
| `pnpm typecheck` · `lint` · `test` · `build`            | Workspace checks                                     |
| `pnpm check:architecture` · `check:security`            | Mechanical guards                                    |
| `pnpm verify:runtime:*`                                 | Full-stack runtime verifiers (need running services) |
| `pnpm api:export-openapi`                               | Regenerate the OpenAPI contract                      |
| `pnpm infra:up` / `infra:down`                          | Local infrastructure                                 |

## Documentation map

| Subject                                            | Authoritative document                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Engineering rules & boundaries (agents and humans) | [`AGENTS.md`](AGENTS.md)                                               |
| Current architecture                               | [`docs/architecture/README.md`](docs/architecture/README.md)           |
| CCTV / live streaming                              | [`docs/architecture/cctv.md`](docs/architecture/cctv.md)               |
| Domain model                                       | [`docs/domain/README.md`](docs/domain/README.md)                       |
| DoSJE domain knowledge base                        | [`docs/DoSJE.md`](docs/DoSJE.md)                                       |
| API contract                                       | [`docs/contracts/README.md`](docs/contracts/README.md)                 |
| Development setup                                  | [`docs/development/setup.md`](docs/development/setup.md)               |
| Environments & isolation                           | [`docs/development/environments.md`](docs/development/environments.md) |
| Deployment status (implemented vs planned)         | [`docs/deployment.md`](docs/deployment.md)                             |
| Design system (colours, typography, components)    | [`DESIGN.md`](DESIGN.md)                                               |
| Ownership                                          | [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md)                               |
| Architecture decisions                             | [`docs/decisions/`](docs/decisions/)                                   |
| CCTV design/phase history                          | [`docs/history/`](docs/history/)                                       |

## Security rules you inherit

- Server is authoritative for authZ, jurisdiction, workflows, disclosure.
- Never send what the user may not see (§34). Never leak DB/provider errors
  (§18).
- Secrets stay out of the repo (§22); `pnpm check:security` enforces the
  high-signal cases.
- Tests must cover failure paths: unauthorised, wrong jurisdiction, invalid
  transition, duplicate offline op, evidence-integrity failure (§49).

See [`docs/development/setup.md`](docs/development/setup.md) for day-to-day
workflows and [`AGENTS.md`](AGENTS.md) for the full operating manual.
