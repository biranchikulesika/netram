# Netram

Smart real-time monitoring and inspection platform for the Department of Social Justice & Empowerment (DoSJE), Government of India (Smart India Hackathon problem statement **SIH26095**). Netram provides public authorities with an accountable, centralized window into government-funded institutions: live project monitoring, structured mobile inspections, grievance redressal, CCTV surveillance, and AI-assisted anomaly detection.

> **AI is advisory, not authoritative.** Machine learning models detect anomalies and assist decision-makers, but never declare fraud or alter official records autonomously. Every signal remains reviewable information routed through verified administrative workflows.

---

## What is Implemented

- **Core Platform** — Modular-monolith REST API (`/api/v1`) with server-authoritative authorization, jurisdiction scoping, project lifecycle, inspections → findings → corrective actions (ATR workflow), tamper-evident evidence capture, complaints, notifications, audit trails, and transactional outbox event delivery.
- **Web Platform** — Next.js 15 web application with React Server Components: role-based workspaces, project registry, live CCTV control room, administrative review queues, and Action Inbox.
- **Inspector Mobile App** — Standalone React Native / Expo Android application with offline operation queue, GPS-fenced check-in, and capture-time SHA-256 evidence hashing.
- **Realtime Hub** — Outbox-driven authorized WebSocket delivery (transient event transport; authoritative state lives in PostgreSQL).
- **CCTV Live Streaming** — Camera → RTSP → MediaMTX → WebRTC (WHEP) / HLS with control-plane tokenization, session lifecycle management, and protocol abstraction ([`docs/architecture/cctv.md`](docs/architecture/cctv.md)).
- **Advisory AI Service** — Python / FastAPI service evaluating attendance discrepancy and computer-vision anomaly scores, mapped to human review lifecycles.
- **Financial & Attendance Reconciliations** — Strict mathematical tracking ensuring $\text{Allocated} \ge \text{Released} \ge \text{Utilised}$ across schemes, and multi-source cross-checking (biometric vs. institution-reported vs. CCTV headcount).

---

## Repository Layout

| Path | Purpose |
| :--- | :--- |
| `apps/web` | Next.js web platform (Server Components by default) |
| `apps/inspector-mobile` | Standalone Expo / React Native Android inspector application |
| `services/api` | Core modular monolith REST API (`/api/v1`) |
| `services/realtime` | Authorized event delivery (outbox → WebSocket) |
| `services/ai` | Advisory anomaly detection service (Python / FastAPI) |
| `services/cctv-gateway` | CCTV media control plane and stream abstraction |
| `packages/{types,validation,api-client,data,ui,config}` | Shared domain contracts, persistence, and typed clients |
| `db/seed` | Deterministic synthetic development & hackathon demo seed |
| `infra/` | MediaMTX and camera simulation configurations |
| `scripts/` | Architecture guards, security checks, and verification scripts |

---

## Development Quickstart

**Requirements:** Node.js ≥ 22, pnpm ≥ 9, Docker / Podman.

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables
cp .env.example .env

# 3. Start local backing infrastructure (PostgreSQL, Redis, MinIO)
pnpm infra:up

# 4. Migrate database from zero and seed deterministic demo dataset
pnpm db:setup

# 5. Start development servers
pnpm --filter @netram/api dev               # Core API on :3001
pnpm --filter @netram/web dev               # Web application on :3000
pnpm --filter @netram/inspector-mobile start # Mobile dev server
```

For full setup instructions, database lifecycle commands, and verification scripts, see [`docs/development/setup.md`](docs/development/setup.md).

| Command | Purpose |
| :--- | :--- |
| `pnpm db:setup` / `db:reset` / `db:seed` | Reset and apply deterministic seed data from scratch |
| `pnpm typecheck` · `lint` · `test` · `build` | Workspace validation and unit tests |
| `pnpm check:architecture` · `check:security` | Mechanical architectural and secret scanning guards |
| `pnpm api:export-openapi` | Export canonical OpenAPI schema (`openapi.json`) |
| `pnpm infra:up` / `infra:down` | Manage local Docker support containers |

---

## Documentation Map

| Subject | Authoritative Document |
| :--- | :--- |
| **Master Documentation Index** | [`docs/README.md`](docs/README.md) |
| Engineering Operating Manual & Boundaries | [`AGENTS.md`](AGENTS.md) |
| System Architecture & Operational Flows | [`docs/architecture/README.md`](docs/architecture/README.md) |
| CCTV & Live Streaming Infrastructure | [`docs/architecture/cctv.md`](docs/architecture/cctv.md) |
| Domain Concepts & Lifecycle State Machines | [`docs/domain/README.md`](docs/domain/README.md) |
| DoSJE Welfare Schemes & Social Audit Standards | [`docs/DoSJE.md`](docs/DoSJE.md) |
| API Contracts & Shared Packages Catalogue | [`docs/contracts/README.md`](docs/contracts/README.md) |
| Local Development & Environment Setup | [`docs/development/setup.md`](docs/development/setup.md) |
| Production Single-VPS Deployment Topology | [`docs/deployment.md`](docs/deployment.md) |
| UI/UX Design System Specification | [`DESIGN.md`](DESIGN.md) |
| Team Ownership & Codeowners | [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md) |
| Architecture Decision Records (ADRs) | [`docs/decisions/`](docs/decisions/) |
| Security Policy & Vulnerability Disclosure | [`SECURITY.md`](SECURITY.md) |
| License & Intellectual Property Terms | [`LICENSE`](LICENSE) |

---

## Security & Responsible Disclosure

- **Server Authority:** The server is the authoritative decision-maker for authentication, role-based access control (RBAC), jurisdiction boundaries, and lifecycle mutations.
- **Server-Side Selective Disclosure:** Unauthorized fields and sensitive records are omitted at the API level rather than hidden in the client interface.
- **Sanitized Responses:** Stack traces, internal SQL exceptions, and cloud provider details are never leaked in client-facing HTTP payloads.
- **Zero Committed Secrets:** Credentials, tokens, and private keys remain strictly excluded from repository history, validated via `pnpm check:security`.
- **Reporting Security Issues:** Please consult [`SECURITY.md`](SECURITY.md) for disclosure guidelines. Security reports must be sent directly to **[netram@kulesika.in](mailto:netram@kulesika.in)**.

---

## License & Intellectual Property Notice

**Copyright © 2026 The Netram Team (Smart India Hackathon 2026 — Team SIH26095). All Rights Reserved.**

This repository is made **public solely for evaluation, review, and judging purposes** in connection with Smart India Hackathon 2026. 

Public visibility on GitHub does **not** grant permission for open-source redistribution, commercial use, copying of UI/UX design components, or claiming this project as your own. Unauthorized copying, mirroring, re-branding, or presenting this work without prior written permission and prominent attribution is strictly prohibited. Refer to [`LICENSE`](LICENSE) for complete terms.
