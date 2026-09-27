# Architecture

**Authority:** this is the current architecture overview for NETRAM. It
describes the system as implemented. For what changed and why, see
[`docs/decisions/`](../decisions/) (ADRs) and [`docs/history/`](../history/)
(implementation records, including the CCTV build-out).

## System shape

A modular monolith backend with services separated only where the boundary is
justified by real constraints (AGENTS.md §7):

```
   apps/web (Next.js)        apps/inspector-mobile (Expo)
        │  typed clients (packages/api-client)  │
        └──────────────┬─────────────────────────┘
                       ▼
        services/api — REST /api/v1  (modular monolith)
        authority for app behaviour: authZ, jurisdiction, workflows,
        audit, outbox, session lifecycle
                       │ repository interfaces
                       ▼
        packages/data — Drizzle/PostgreSQL (the only DB access)
                       ▼
                   PostgreSQL

   services/realtime    outbox → poller → WS (delivery, never truth)
   services/ai          advisory anomaly review (Python/FastAPI, :8000)
   services/cctv-gateway media control plane (see docs/architecture/cctv.md)
   netram-media (MediaMTX) the CCTV media server (data plane)
```

## Major data flows

- **Requests:** web/mobile → typed client → `/api/v1` → application/domain
  service → repository → PostgreSQL. The presentation layer never knows where
  data lives; the domain never knows how persistence works (AGENTS.md §8).
- **Events:** state changes write an outbox row atomically with the state
  change (§25); the realtime service polls and delivers over WebSocket.
  Realtime is delivery only — clients resync from the API after reconnect.
- **CCTV media:** Camera → RTSP → MediaMTX → WebRTC/HLS → browser, with the
  gateway as control plane. Full detail: [`cctv.md`](cctv.md).

## Mandatory boundaries

1. **Data access** lives in `packages/data` only — Drizzle, `postgres`, SQL,
   and transactions never appear in apps or other services.
2. **Config** flows through `packages/config` (validated Zod schemas). No
   scattered `process.env` outside it.
3. **Cross-service communication** happens through explicit contracts (HTTP,
   typed packages, events), never source imports (AGENTS.md §63).
4. **The server owns truth.** Realtime messages, AI output, and client state
   are never authoritative.
5. **No vendor leakage.** Supabase, MediaMTX, Twilio, cloud SDKs sit behind
   adapters/interfaces; the core domain speaks Netram concepts (AGENTS.md §64).
6. **Disclosure is server-side.** Fields a user may not see are omitted from
   responses, never merely hidden in the UI (AGENTS.md §34).

## Domain

The domain model and its separations (User, RoleAssignment, Jurisdiction,
Project, Inspection, Finding, CorrectiveAction, Evidence, AIAnomaly, …) are
described in [`docs/domain/README.md`](../domain/README.md). The DoSJE domain
knowledge base (real department structure, schemes, social-audit process, and
the mapping into NETRAM's data model) is [`docs/DoSJE.md`](../DoSJE.md).

## Contracts

The HTTP API contract (OpenAPI export + route inventory) is
[`docs/contracts/README.md`](../contracts/README.md). `openapi.json` is
generated (`pnpm api:export-openapi`) and CI-pinned against the code.

## Environments & deployment

Environment matrix and isolation rules:
[`docs/development/environments.md`](../development/environments.md).
Deployment status (what is implemented vs planned):
[`docs/deployment.md`](../deployment.md).

## Enforcement

Architectural boundaries are checked mechanically (`pnpm check:architecture`)
and socially (`.github/CODEOWNERS`, ownership in
[`docs/OWNERSHIP.md`](../OWNERSHIP.md)).
