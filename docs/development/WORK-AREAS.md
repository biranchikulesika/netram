# Work Areas

Detailed file scope, responsibilities, and dependencies for each parallel work area.

---

## Area 1: Web Platform

**Owner:** @biranchikulesika

### Scope

```
apps/web/
  app/                # Next.js App Router pages and layouts
    page.tsx          # Landing page
    login/            # Authentication
    projects/         # Project list + create form
    inspections/      # Inspections list
    control-room/     # CCTV grid, anomaly review, attendance overview
    complaints/       # Complaint intake
    corrective-actions/# Corrective action tracking
    reports/          # Report status
    audit/            # Audit trail view
    notifications/    # In-app notifications
    admin/            # Administration
    components/       # nav-header, realtime-provider, camera-card, etc.
  lib/
    api.ts            # Shared API/session helpers
  next.config.mjs     # Next.js configuration
  globals.css         # Styling
  package.json        # Dependencies (next, react, @netram/api-client, @netram/types)
packages/ui/
  src/index.ts        # Presentation primitives (empty shell — populate only when a primitive is needed by 2+ consumers)
```

### Responsibilities

- All SSR pages and layouts (website, workspace views, authentication, dashboards)
- Server Components (default) and Client Components (interaction, hooks, realtime UI)
- Browser-side API calls via `@netram/api-client`
- Responsive layout, accessibility, image optimization (`next/image`)
- No business logic in components; no direct database access; no backend-only imports

### Key contracts consumed

| Package | What's used |
|---------|-------------|
| `@netram/api-client` | Typed API calls (all modules) |
| `@netram/types` | Domain types for rendering |
| `@netram/validation` | Client-side validation where applicable |

### Key contracts owned

- Page-level routing (App Router conventions)
- `packages/ui` presentation primitives (only when genuinely reusable across 2+ consumers)

### Dependencies on other areas

| Area | Dependency |
|------|-----------|
| Core API + Data | API routes must exist for all pages |
| AI + CCTV + Realtime | Realtime events for live UI; CCTV camera views; AI anomaly display |
| Inspector Mobile | None (separate apps) |

### Parallel rules

- Do not modify `services/api/**` routes without Core API owner review.
- Do not add business logic to components.
- Do not directly import `@netram/data`, Drizzle, or any backend-only module.
- Can add `NEXT_PUBLIC_*` env vars (client-exposed) to `.env.example` only with documentation.

### Verification

- `pnpm --filter @netram/web typecheck`
- `pnpm --filter @netram/web lint`
- `pnpm --filter @netram/web build`
- `pnpm verify:runtime:web` (requires API on 3001 + web on 3000)

---

## Area 2: Inspector Mobile

**Owner:** @srutiswarupa @smrutirekhaparida576

### Scope

```
apps/inspector-mobile/
  src/
    offline/          # Offline queue, evidence capture, local DB
      db.ts           # SQLite (expo-sqlite) or in-memory fallback
      queue.ts        # Offline operation queue
      evidence.ts     # Local evidence capture + hashing
      queue.test.ts   # Queue unit tests
  app.json            # Expo configuration
  package.json        # Dependencies (expo, react-native, @netram/api-client)
```

### Responsibilities

- Inspector-facing screens (inspection list, inspection detail, evidence capture, observation form)
- Offline queue with operation-based idempotency (client-generated operation IDs)
- Local evidence capture + SHA-256 hashing before upload
- Background media upload to object storage via API
- Conflict detection against server state (server is authoritative)
- Reconnection and resync after offline periods

### Key contracts consumed

| Package | What's used |
|---------|-------------|
| `@netram/api-client` | Typed API calls |
| `@netram/types` | `Inspection`, `Evidence`, `Observation`, `OfflineOperation` types |
| `@netram/validation` | Input validation on offline payloads |

### Key contracts owned

- Offline operation protocol (operation ID, status tracking, conflict handling)
- Evidence capture flow (local hash → upload → verify integrity)
- Inspector-specific UI screens

### Dependencies on other areas

| Area | Dependency |
|------|-----------|
| Core API + Data | API endpoints for inspection sync, evidence upload, observation submission |
| Inspector Mobile (self) | Offline queue protocol is internal |
| AI + CCTV | None (AI is advisory; mobile reads anomalies if displayed) |

### Parallel rules

- Do not modify `services/api/**` inspection routes without Core API owner review.
- Do not implement authority-level decisions (state transitions, notices) in the mobile app.
- Offline operations must be idempotent and operation-based, not last-write-wins.
- Server is always authoritative; mobile is never the source of truth for inspection state.

### Verification

- `pnpm --filter @netram/inspector-mobile typecheck`
- `pnpm --filter @netram/inspector-mobile lint`
- `pnpm --filter @netram/inspector-mobile test`
- `pnpm verify:runtime:mobile` (requires API on 3001; runs under Node with in-memory SQLite — no emulator needed)

---

## Area 3: Core API + Data Layer

**Owner:** @biranchikulesika @jyotirmaya2004

### Scope

```
services/api/
  src/
    modules/          # 20 API modules (see docs/contracts/README.md)
      ai-anomalies/   # AI anomaly review endpoints
      assignments/    # Inspector assignment orchestration
      attendance/     # Biometric attendance tracking
      audit/          # Audit event queries
      auth/           # Authentication (dev/supabase providers)
      authorization/  # Permission checks
      cctv/           # CCTV camera management
      complaints/     # Complaint intake + workflow
      corrective-actions/  # Corrective action tracking
      evidence/       # Evidence upload + integrity
      findings/       # Finding lifecycle
      health/         # API health endpoint
      inspections/    # Inspection workflow
      notifications/  # In-app notification delivery
      observations/   # Inspector observations
      projects/       # Project lifecycle
      realtime/       # Token exchange for WS auth
      reports/        # Report generation
      user-admin/     # User/role management
      vc/             # Video conferencing
    app.ts            # Fastify app setup + middleware
    server.ts         # Server entry point
  workers/            # Background worker processes
    run-workers.ts    # Worker pool launcher
    outbox-dispatcher.worker.ts  # Outbox → notification queue
    notification.worker.ts       # Notification delivery
    report.worker.ts             # Report generation
    attendance-export.worker.ts  # Attendance data export
    scheduled-jobs.worker.ts     # Cron-like scheduled tasks

packages/data/
  src/
    db/
      client.ts       # Drizzle database client
      schema.ts       # PostgreSQL table definitions
    migrations/       # Drizzle migration files (6 migrations)
    repositories/     # Repository implementations (18+ files)
      outbox.repository.ts   # Outbox event persistence
      inspection.repository.ts
      evidence.repository.ts
      finding.repository.ts
      ...

packages/types/src/   # Canonical domain/contract types (22 type files)
packages/validation/src/  # Zod validation schemas (21 schema files)
packages/config/src/      # Centralized env config (server, client, realtime, cctv)
```

### Responsibilities

- REST API under `/api/v1/` (73 routes — see `docs/contracts/README.md`)
- Application and domain logic (state transitions, authorization, audit, outbox)
- Database schema, migrations, seed data
- Repository implementations (all DB access confined to `packages/data`)
- Background workers (outbox dispatch, notifications, reports, attendance export, scheduled jobs)
- No business logic in route handlers; no DB queries outside `packages/data`

### Key contracts owned

| Package | What's owned |
|---------|-------------|
| `packages/types` | All domain types (`Inspection`, `Finding`, `Evidence`, `Complaint`, `User`, `Role`, etc.) |
| `packages/validation` | All Zod validation schemas for API requests/responses |
| `packages/data` | All repository interfaces and implementations |
| `packages/config` | All environment configuration |
| `packages/api-client` | Typed API client (consumed by web + mobile) |
| OpenAPI spec | `docs/contracts/README.md` + auto-generated from routes |

### Domain modules (have `domain/` folder)

`ai-anomalies`, `attendance`, `audit`, `complaints`, `corrective-actions`, `evidence`, `findings`, `inspections`, `notifications`, `observations`, `projects`, `reports`, `vc`

### Orchestration-only modules (no `domain/` folder)

`assignments` (201 lines), `auth` (264 lines), `authorization` (143 lines), `cctv` (523 lines), `health` (68 lines), `realtime` (57 lines), `user-admin` (459 lines)

These are thin orchestration services. Their domain objects live in `@netram/types`. Do not force `domain/` folders on them unless the logic grows substantially.

### Dependencies on other areas

| Area | Dependency |
|------|-----------|
| Inspector Mobile | Mobile's offline operations must be accepted by the API |
| Web Platform | Web's SSR pages depend on API routes |
| AI + CCTV + Realtime | AI anomalies are stored via API; CCTV cameras managed via API; realtime events published from API's outbox |

### Parallel rules

- Route handlers (`http/routes.ts`) must call application services, not contain business logic directly.
- All database access goes through `packages/data` repositories. Never import Drizzle or PostgreSQL drivers outside `packages/data`.
- Schema changes require: update migration → `pnpm db:setup` → verify seed.
- OpenAPI export must remain idempotent: `pnpm api:export-openapi`.

### Verification

- `pnpm --filter @netram/api typecheck`
- `pnpm --filter @netram/api lint`
- `pnpm --filter @netram/api test` (149 tests across 23 files)
- `pnpm --filter @netram/data test` (repository tests — require database; verify via `pnpm db:setup` + runtime verifiers)
- `pnpm check:architecture` (boundary guards)
- `pnpm check:security` (secret scan)
- `pnpm api:export-openapi` (idempotent contract export)

---

## Area 4: AI + CCTV + Realtime

**Owner:** @dipteshrpradhan @jyotirmaya2004

### Scope

```
services/ai/
  app/
    domain.py         # Advisory anomaly domain (score, severity, confidence)
    main.py           # Service entry point
  tests/
    test_main.py      # pytest suite
  pyproject.toml      # Python tooling (pytest)
```
Note: `services/ai` is currently a small Python template (67 LOC across 3 files). It is advisory only — never declares fraud or makes administrative decisions.

```
services/cctv-gateway/
  src/
    providers/        # Camera provider adapters
      provider.ts     # CameraProvider interface
      simulated-provider.ts  # Simulated camera for dev/testing
    auth/             # Stream token signing/verification
    server.ts         # Fastify server (health, cameras, health, streams, snapshots)

services/realtime/
  src/
    server.ts         # Fastify + WebSocket server
    hub.ts            # Topic-based event routing to WS subscribers
    outbox-poller.ts  # Polls outbox_events, broadcasts to WS
    authorizer.ts     # JWT → topic authorization
    config.ts         # Service configuration
```

### Responsibilities

**AI service:**
- Advisory model inference (anomaly detection, confidence scoring)
- Frame processing for CCTV streams
- Attendance estimation
- AI results are reviewable — never make authoritative decisions (no auto-suspension, no fraud declaration)

**CCTV Gateway:**
- Provider abstraction (camera operations behind `CameraProvider` interface)
- Authorized stream relay (signed tokens, short-lived URLs)
- Stream health monitoring
- Raw RTSP credentials never exposed to clients

**Realtime service:**
- Outbox poller reads `pending` events from `outbox_events` table
- Broadcasts events to WebSocket subscribers based on topic subscriptions
- Authorization via JWT → allowed topics
- Delivery only — never authority; clients resync from API after reconnect

### Key contracts consumed

| Package | What's used |
|---------|-------------|
| `@netram/types` | `DomainEvent`, `AIAnomaly`, `CCTVCamera`, `CameraHealthStatus`, event types |
| `@netram/data` | `OutboxRepository`, CCTV camera repositories |
| `@netram/config` | Service configuration schemas |

### Key contracts owned

- `CameraProvider` interface (provider adapters plug in here)
- AI anomaly response shapes (score, severity, confidence, evidence, explanation)
- Realtime event format: `{ event: "netram.event", data: { type, id, occurredAt, resourceType, resourceId, payload } }`
- Topic matching protocol: `evidence.*`, `inspection.*`, etc.

### Dependencies on other areas

| Area | Dependency |
|------|-----------|
| Core API + Data | AI results stored via API; CCTV cameras registered in DB; outbox events originate from API transactions |
| Inspector Mobile | Mobile receives realtime events (offline queue syncs against API, not realtime) |
| Web Platform | Web UI displays AI anomalies and CCTV views; subscribes to realtime events |

### Known architectural limitation

The `outbox_events` table is consumed by **two independent pollers**:
1. The realtime outpoller (`services/realtime/src/outbox-poller.ts`) — broadcasts to WS subscribers.
2. The outbox dispatcher worker (`services/api/workers/outbox-dispatcher.worker.ts`) — enqueues to BullMQ for notifications.

Both use a blind `SELECT` without `FOR UPDATE SKIP LOCKED` (`packages/data/src/repositories/outbox.repository.ts:69`). Whichever consumer claims the row first marks it processed; the other consumer does not see it. This is a documented race — not a product defect — but it means realtime event delivery may be delayed or missed when the worker pool is active. Delivery is verified via DB-persisted outbox rows and the realtime hub unit test (`services/realtime/src/hub.test.ts`).

### Parallel rules

- AI must never declare fraud as fact or make irreversible administrative decisions.
- CCTV provider adapters must implement `CameraProvider` interface; do not leak vendor-specific types into the application.
- Realtime service must not be treated as the source of truth; clients must resync from the API.
- Do not modify `packages/data` outbox repository without Core API owner review.

### Verification

- `pytest` in `services/ai` (Python service) — run from `services/ai`
- `pnpm --filter @netram/cctv-gateway typecheck && pnpm --filter @netram/cctv-gateway test` (12 tests)
- `pnpm --filter @netram/realtime typecheck && pnpm --filter @netram/realtime test` (1 test)
- `pnpm verify:runtime:cctv` (requires API on 3001 + gateway on 3003)
- `pnpm verify:runtime:evidence` (requires API on 3001 + realtime on 3002 + MinIO on 9000)

---

## Area 5: Integration + Infrastructure

**Owner:** @BISHNU-CHARAN-BARIK

### Scope

```
infrastructure/        # Docker/infra config (currently empty shell)
.github/
  workflows/ci.yml     # CI pipeline
scripts/
  architecture-check.mjs   # Boundary guard script
  security-check.mjs       # Secret/security scan
  verify-web-runtime.ts    # Web runtime verifier
  verify-cctv-runtime.ts   # CCTV runtime verifier
  verify-evidence-runtime.ts  # Evidence runtime verifier
  verify-mobile-offline-runtime.ts  # Mobile runtime verifier
  verify-workers-runtime.ts  # Worker runtime verifier
docs/
  architecture/README.md    # Architecture overview
  domain/README.md          # Domain model reference
  contracts/README.md       # API contract inventory
  development/setup.md      # Environment setup
  OWNERSHIP.md              # Team ownership
  decisions/                # Architecture decision records
```

### Responsibilities

- Docker Compose configuration for local development (PostgreSQL, Redis, MinIO)
- CI pipeline (typecheck, lint, test, build, architecture guard, security scan)
- Runtime verification scripts (5 verifiers)
- Documentation (architecture, domain, contracts, development setup)
- Environment management (`.env.example` documentation)
- Architecture enforcement (boundary checks, secret scans)

### Dependencies on all other areas

This area touches everything but owns nothing that other areas depend on at the code level. It provides the infrastructure and verification tooling that all areas use.

### Parallel rules

- Infrastructure changes (Docker, CI) should not break any area's local development.
- Documentation changes are safe to merge independently.
- Runtime verifier changes should be validated against all running services.
- Do not add secrets to scripts, CI configs, or documentation.

### Verification

- `pnpm check:architecture` (boundary guards)
- `pnpm check:security` (secret scan)
- All `pnpm verify:runtime:*` scripts (require services running)
- CI pipeline green on PR merge (feature → develop → preview → production)

---

## Cross-area dependency graph

```
packages/types + packages/validation + packages/config
        ↑
packages/data + packages/api-client
        ↑
services/api (Core API)
    ↑       ↑
    |       |
    |   services/ai + services/cctv-gateway
    |       ↑
    |   services/realtime
    |       ↑
    |   apps/web (Web Platform)
    |
    +--- apps/inspector-mobile (Inspector Mobile)
```

Dependencies flow **downward**. No upward or circular dependencies. Changing `packages/types` affects everyone — get approval first.
