# Team Tasks

Task backlog by area, with dependency order and parallel readiness. Tasks
describe the next coherent increments for each work area, derived from the
current repository state and the audit reports —
not a speculative roadmap.

## Status legend

| Status | Meaning |
|--------|---------|
| READY | Unblocked and useful now |
| IN PROGRESS | Code exists; check `git log` for latest state before editing |
| BLOCKED | Depends on an upstream task/decision |
| UNKNOWN / REQUIRES OWNER DECISION | Needs an architectural call, not derivable from the repo |

## P0 — Foundation (done, for reference)

| # | Task | Area | Status |
|---|------|------|--------|
| P0.1 | Drizzle schema + migrations (local Postgres, reproducible) | Core API + Data | DONE |
| P0.2 | Deterministic seed (states, authorities, projects, users, teams, inspections, CCTV, AI samples) | Core API + Data | DONE |
| P0.3 | Domain types + validation schemas (`packages/types`, `packages/validation`) | Core API + Data | DONE |
| P0.4 | Repository layer (`packages/data`, all DB access confined here) | Core API + Data | DONE |
| P0.5 | API modules: auth, authorization, projects, inspections, findings, evidence, complaints, audit, notifications, cctv, ai-anomalies, reports, vc, attendance | Core API + Data | DONE |
| P0.6 | API client (`packages/api-client`) + OpenAPI export (idempotent) | Core API + Data | DONE |
| P0.7 | Outbox + workers (dispatch, notifications, reports, attendance export, scheduled jobs) | Core API + Data | DONE |
| P0.8 | Realtime service (WS, hub, outbox poller, authorization) | Realtime | DONE |
| P0.9 | CCTV gateway (provider abstraction, stream relay, simulated provider) | CCTV | DONE |
| P0.10 | Web app shell (SSR, session, workspaces) | Web | DONE |
| P0.11 | Inspector mobile shell (Expo, offline queue, evidence) | Mobile | DONE |
| P0.12 | Architecture guards + security scan | Integration | DONE |
| P0.13 | CI pipeline (typecheck, lint, test, build, guards) | Integration | DONE |

## Next coherent increments by area

### Core API + Data (Area 3: @biranchikulesika @jyotirmaya2004)

| # | Task | Status | Depends on |
|---|------|--------|-----------|
| API-1 | Persist AI anomaly review decisions (AIAnomaly → review/dismiss/investigate lifecycle) | READY | — |
| API-2 | Complaint workflow end-to-end (intake → review → resolution, audited) | BLOCKED | domain decision on complaint closure rules |
| API-3 | Corrective action verification/closure workflow | READY | — |
| API-4 | Scheduled job: overdue inspection + `CorrectiveActionOverdue` event emission | READY | — |
| API-5 | Report generation job: full payload contract + file delivery | BLOCKED | report schema decision (PDF/docx/storage key) |
| API-6 | VC session lifecycle (create/join/end, participant authorization, audit) | READY | — |
| API-7 | Data-layer integration test harness for repositories | UNKNOWN / REQUIRES OWNER DECISION | audit chose document-defer; revisit when coverage matters |
| API-8 | Resolve worker-pool/realtime outbox contention (blind `claimPending` without `FOR UPDATE SKIP LOCKED`) | UNKNOWN / REQUIRES OWNER DECISION | documented race, see WORK-AREAS.md |

### Web Platform (Area 1: @biranchikulesika)

| # | Task | Status | Depends on |
|---|------|--------|-----------|
| WEB-1 | Workspace routing + role-based navigation shell | READY | — |
| WEB-2 | Project management pages (list → detail → lifecycle actions) | READY | — |
| WEB-3 | Inspection detail + observation/finding UI wired to API | READY | — |
| WEB-4 | Evidence viewer with server-verified integrity status | READY | — |
| WEB-5 | Control room view (CCTV grid + realtime events) | BLOCKED | realtime event contract + CCTV relay UI |
| WEB-6 | Complaint intake + review UI | READY | — |
| WEB-7 | AI anomaly review workspace | BLOCKED | API-1 (review lifecycle) |
| WEB-8 | Report page (generate/download via job) | BLOCKED | API-5 |

### Inspector Mobile (Area 2: @srutiswarupa @smrutirekhaparida576)

| # | Task | Status | Depends on |
|---|------|--------|-----------|
| MOB-1 | Inspection list/detail + offline queue UI | READY | — |
| MOB-2 | Offline evidence capture (hash → queue → upload → verify) | READY | — |
| MOB-3 | Observation submission with conflict handling | READY | — |
| MOB-4 | Sync status screen + resync after reconnect | READY | — |
| MOB-5 | Offline finding drafts (synced as operations, not authority decisions) | READY | — |
| MOB-6 | Device/attendance check-in with geofence guidance | READY | — |

### AI + CCTV + Realtime (Area 4: @dipteshrpradhan @jyotirmaya2004)

| # | Task | Status | Depends on |
|---|------|--------|-----------|
| AI-1 | Grow `services/ai` beyond the Python template: anomaly score/severity/confidence contract + advisory result shape | READY | — |
| AI-2 | Anomaly review/dismiss/investigate API consumer + audit | BLOCKED | API-1 |
| AI-3 | Attendance estimation models + reportable results | READY | provider port (attendance) |
| CCTV-1 | Additional provider adapters (beyond simulated) | READY | CameraProvider interface |
| CCTV-2 | Stream health monitoring + re-registration | READY | — |
| RT-1 | Outbox contention fix (shared `claimPending` with dispatcher worker) | UNKNOWN / REQUIRES OWNER DECISION | same decision as API-8 |

### Integration + Infrastructure (Area 5: @BISHNU-CHARAN-BARIK)

| # | Task | Status | Depends on |
|---|------|--------|-----------|
| INFRA-1 | Docker Compose for all services (dev parity: web, api, realtime, cctv, ai, workers) | READY | — |
| INFRA-2 | Runtime verifiers in CI (smoke suite on demo env) | READY | — |
| INFRA-3 | Environment matrix doc (dev/CI/demo/prod isolation) | READY | — |
| INFRA-4 | E2E coverage for web critical flows | UNKNOWN / REQUIRES OWNER DECISION | audit deferred E2E; revisit with owner |

## Dependency order

```
P0 (complete)
  ├── API-1, API-3, API-4, API-6      (independent, READY)
  ├── WEB-1..4, WEB-6, MOB-1..6       (independent of API increments)
  ├── AI-1, AI-3, CCTV-1, CCTV-2      (independent)
  └── API-2, API-5                    (BLOCKED on owner decisions)
        └── WEB-5, WEB-7, WEB-8, AI-2 (wait for their API dependencies)
```

## Parallel readiness

- Areas 1, 2, 4, and the independent API tasks can all start immediately.
- Only tasks explicitly marked BLOCKED or UNKNOWN are not ready.
- Any task touching `packages/types`/`packages/validation`/`packages/api-client`
  follows the change protocol in SHARED-CONTRACTS.md.
- The two owner decisions (API-8 outbox contention, API-7/INFRA-4 test harness)
  gate only future-hardening work, not the current increments.
