# Netram Environment Matrix & Isolation Specification

**Authority:** AGENTS.md §11–13, §21–22, §28, §30.
Deployment status (what is actually running): [`../deployment.md`](../deployment.md).
Day-to-day setup: [`setup.md`](setup.md).

This document defines the configuration, network topology, persistence rules,
and security isolation across all Netram deployment targets. The `dev` and
`ci` columns are **implemented**; `demo` and `prod` rows describe required
properties of future environments (**Planned** - nothing is deployed there
yet).

---

## 1. Environment Matrix Overview

| Dimension | Local Development (`dev`) | CI / Pull Requests (`ci`) | Demo / Staging (`demo`) | Production (`prod`) |
|---|---|---|---|---|
| **Purpose** | Day-to-day engineer development & vertical slices | Automated regressions, guards, tests, and builds | Client demonstration, preview testing, QA verifications | Mission-critical government oversight platform |
| **Hosting** | Local workstation / Docker | GitHub Actions runner (`ubuntu-latest`) | Cloud container orchestrator (e.g., ECS/K8s/Fly) | Sovereign government cloud infrastructure |
| **PostgreSQL** | Local Docker container (`postgres:16-alpine`) | Ephemeral service container (`postgres:16-alpine`) | Managed PostgreSQL (Supabase / RDS) | Dedicated high-availability PostgreSQL with PITR |
| **DB Reset / Seed** | Allowed (`pnpm db:setup` / deterministic seed) | Ephemeral on every run (`pnpm db:setup`) | Managed seed reset upon deployment | **FORBIDDEN**. Never reset; forward-only migrations |
| **Redis** | Local container (`redis:7-alpine`) | Service container or mock in memory | Managed Redis instance | Multi-node Redis cluster with persistence |
| **Object Storage (MinIO/S3)** | Local MinIO (`localhost:9000`) | Local ephemeral MinIO | Dedicated S3/MinIO demo bucket | Hardened sovereign S3 bucket with WORM compliance |
| **Auth Provider** | Dev-auth token exchange (`/api/v1/auth/dev-login`) | Dev-auth mock tokens | Controlled staging auth / dev tokens | Production IAM / OIDC / Sovereign Govt IdP |
| **Realtime Service** | Local WS (`ws://localhost:3002`) | Test socket server | Managed WS server | Load-balanced WS cluster behind TLS |
| **AI Inference** | Local advisory service (`localhost:8000`) | Pytest test harness | Advisory inference container | Dedicated GPU/accelerated advisory service |
| **CCTV Gateway** | Simulated camera feeds (`localhost:3003`) | Unit/integration mocks | Simulated + test hardware streams | Authorised RTSP/WebRTC gateway |

---

## 2. Port Allocation (Local Development)

| Service | Internal Port | Host Port | Protocol | Notes |
|---|---|---|---|---|
| **PostgreSQL** | 5432 | 5432 | TCP | Default user: `netram`, db: `netram` |
| **Redis** | 6379 | 6379 | TCP | Appendonly disabled in local dev |
| **MinIO API** | 9000 | 9000 | HTTP | S3-compatible evidence storage |
| **MinIO Console** | 9001 | 9001 | HTTP | Web console credentials: `netram` / `netram-secret` |
| **Web Frontend** | 3000 | 3000 | HTTP | Next.js full dashboard and workspaces |
| **Core API** | 3001 | 3001 | HTTP | Fastify modular monolith |
| **Realtime Gateway** | 3002 | 3002 | HTTP / WS | WebSockets event delivery |
| **CCTV Gateway** | 3003 | 3003 | HTTP | Camera stream acquisition & relay |
| **AI Advisory Service** | 8000 | 8000 | HTTP | FastAPI model inference |

---

## 3. Strict Isolation Rules (AGENTS.md Compliance)

### 3.1 Database Isolation
- **No Shared Databases:** Environments must **never** share database instances or connection credentials. Local development must never point to demo or production.
- **Production Reset Ban:** Destructive commands (`pnpm db:reset`, `DROP DATABASE`, manual table truncations) are strictly forbidden against production.
- **Reproducible Migrations:** Schema changes must be applied strictly through Drizzle migrations from zero (`packages/data/src/db/migrations`).

### 3.2 Secrets and Credentials Isolation
- **No Committed Secrets:** Files matching `.env`, `.env.local`, and `.env.*` (except `.env.example`) are gitignored and blocked by `pnpm check:security`.
- **Client vs. Server Separation:** Only variables prefixed with `NEXT_PUBLIC_` are accessible to client browsers. All database URLs, JWT signing secrets, and service tokens are server-only.
- **Environment Parity via Schema:** All environment variables must be declared in `packages/config/src/env/` using Zod runtime validation. Missing environment variables fail fast at boot time.

### 3.3 Evidence and File Storage Integrity
- **Local Dev:** MinIO bucket `local/netram` is auto-created by `netram-minio-init`.
- **Integrity Guarantee:** Evidence files are SHA-256 hashed at capture and verified byte-for-byte upon retrieval across all environments.

---

## 4. Verification Workflow

To verify environment consistency:
1. `pnpm check:architecture` - Validates file boundaries and .gitignore rules.
2. `pnpm check:security` - Scans for leaked keys, tokens, or credential strings.
3. `pnpm verify:runtime:*` - Executes runtime verification against active local/demo services.
