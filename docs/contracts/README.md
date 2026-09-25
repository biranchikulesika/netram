# Contracts

The HTTP API is the canonical contract. It is exported to
`services/api/openapi/openapi.json` (`pnpm api:export-openapi`) and mirrored by
the typed client in `packages/api-client`.

## Rules

1. REST/JSON under `/api/v1`.
2. Runtime validation at every boundary (Zod schemas in `packages/validation`;
   Fastify consumes them via `z.toJSONSchema`).
3. Standard error shape:

   ```json
   {
     "error": {
       "code": "NOT_FOUND",
       "message": "…",
       "requestId": "…",
       "details": {}
     }
   }
   ```

4. No stack traces, SQL errors, or provider internals in responses.
5. Information disclosure is server-side: unauthorised fields are **omitted**,
   never merely hidden in the UI (AGENTS.md §34).

## Changing an API

The change checklist (AGENTS.md §19): update the contract → update validation →
update backend → update client → update tests → verify consumers. The CI job
fails if `openapi.json` drifts from the code.

## Current surface

All routes are served under `/api/v1/` with `bearerAuth` security unless
otherwise noted.

### Auth

- `POST /auth/dev-login` (dev-auth only)
- `GET /auth/me`

### Projects

- `GET /projects`
- `GET /projects/verification-queue` (`project:approve`; registrations awaiting decision)
- `POST /projects`
- `GET /projects/:id`
- `POST /projects/:id/transitions`

### Inspections

- `GET /inspections`
- `POST /inspections`
- `GET /inspections/:id`
- `GET /inspections/:id/events`
- `POST /inspections/:id/transitions`
- `POST /inspections/sync`

### Findings

- `GET /inspections/:id/findings`
- `POST /inspections/:id/findings`
- `POST /findings/:id/transitions`
- `GET /findings/awaiting-order` (`inspection:review` + `corrective_action:read`; confirmed findings without a corrective action, scoped to the caller's jurisdictions — the authority "pending remediation orders" queue)

### Corrective Actions

- `GET /corrective-actions`
- `POST /corrective-actions`
- `GET /corrective-actions/:id`
- `POST /corrective-actions/:id/submit-atr` (institution lodges the Action Taken Report; automatically advances the order to `submitted`)
- `POST /corrective-actions/:id/review` (authority records a review decision; automatically advances the workflow to `under_review`/`accepted`/`rejected`)

Corrective action status is derived from recorded work — there is no manual status-transition endpoint. `overdue` is produced by the SLA scheduled job; `escalated` is reserved for job-driven escalation.

### Observations

- `GET /inspections/:id/observations`
- `POST /inspections/:id/observations`

### Evidence

- `GET /inspections/:id/evidence`
- `POST /inspections/:id/evidence`
- `POST /evidence/:id/uploads` (multipart/form-data)
- `GET /evidence/:id/content` (binary)
- `POST /evidence/:id/integrity-check`

### Complaints

- `GET /complaints`
- `POST /complaints`
- `GET /complaints/:id`
- `POST /complaints/:id/transitions`

### Audit

- `GET /audit-events`

### Action Inbox

- `GET /action-inbox` (read-only; no extra permission of its own — each section
  appears only when the caller holds the section's decision permission and stays
  within its jurisdiction, AGENTS.md §16-§17, §34)

  Unified pending-decision queue aggregating: project verification
  (`project:approve`), finding review (`inspection:review`), ATR review
  (`corrective_action:approve`), complaint decisions (`complaint:resolve`), AI
  anomaly review (`ai:anomaly:transition`), attendance anomaly review
  (`attendance:anomaly:review`), attendance correction approval
  (`attendance:correction:approve`), expense verification (`expense:verify`),
  financial document verification (`financial_document:verify`), and risk flag
  review (`inspection_flag:review`). Items disappear once the underlying
  workflow moves past its decision point; decisions are executed through each
  workflow's own canonical endpoints (never through the inbox).

### AI Anomalies

- `GET /ai-anomalies`
- `GET /ai-anomalies/:id`
- `POST /ai-anomalies/:id/transitions`

### Assignments

- `GET /inspections/:id/assignments`
- `POST /inspections/:id/assignments`
- `GET /assignments/mine`
- `DELETE /assignments/:id`

### Notifications

- `GET /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`

### User Administration

- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `POST /users/:id/role-assignments`
- `DELETE /role-assignments/:id`
- `GET /roles`
- `PUT /roles/:id/permissions`

### Registry

- `GET /registry/organisations`
- `POST /registry/organisations`
- `GET /registry/programmes`
- `POST /registry/programmes`
- `GET /registry/states` (scheme-scope pickers)
- `GET /registry/districts` (with state names; scope + agency pickers)
- `POST /registry/inspectors`
- `POST /registry/officials`

Permissions for these routes are governed by the
[registry capability matrix](#registry-capability-matrix).

### Realtime

- `POST /realtime/authorize`

### CCTV

The CCTV surface follows the two-plane architecture in
[`../architecture/cctv.md`](../architecture/cctv.md): camera/session control
below, plus the MediaMTX-facing external auth hook. Session lifecycle
(creation, heartbeat, explicit end), the hook route, and health reflect the
implemented Phase 3–5 behaviour.

- `GET /cctv/cameras`
- `GET /cctv/cameras/:id`
- `GET /cctv/cameras/:id/health`
- `POST /cctv/cameras/:id/streams`
- `POST /cctv/cameras/:id/streams/:streamId/heartbeat`
- `DELETE /cctv/cameras/:id/streams/:streamId`
- `GET /cctv/cameras/:id/snapshot`
- `POST /media/auth` (MediaMTX external auth hook; secret-gated, public route)

### Video Conferencing

- `POST /vc/sessions`
- `GET /vc/sessions`
- `GET /vc/sessions/:id`
- `POST /vc/sessions/:id/start`
- `POST /vc/sessions/:id/end`
- `POST /vc/sessions/:id/join`
- `POST /vc/sessions/:id/leave`

### Attendance

- `GET /attendance/overview`
- `GET /attendance/calculations`
- `GET /attendance/devices`
- `GET /attendance/windows`
- `GET /attendance/observations`
- `GET /attendance/identity-mappings`
- `POST /attendance/devices/:id/sync`
- `POST /attendance/devices/:id/events`
- `POST /attendance/observations`
- `GET /attendance/anomalies`
- `GET /attendance/anomalies/:id`
- `POST /attendance/anomalies/:id/review`
- `GET /attendance/anomalies/:id/review-actions`
- `GET /attendance/individual`
- `GET /attendance/config`
- `PUT /attendance/config`
- `POST /attendance/corrections`
- `GET /attendance/corrections`
- `POST /attendance/corrections/:id/decide`
- `POST /attendance/exports`
- `GET /attendance/exports`
- `GET /attendance/exports/:id`
- `GET /attendance/exports/:id/download`

### Health

- `GET /health` (public)
- `GET /ready` (public)
- `GET /docs` (Swagger UI, public)
- `GET /openapi.json` (raw OpenAPI document, public)

## API client source of truth

- `packages/api-client` is **hand-written**, not generated. It mirrors the
  server routes and the OpenAPI document. There is intentionally no code
  generator in this repository (see AGENTS.md §19 and the OpenAPI document).
- The authoritative wire contract is the server route definitions in
  `services/api/src/modules/*/http/routes.ts` plus the processed validation
  schemas from `packages/validation`. `services/api/openapi/openapi.json` is
  the exported snapshot of that contract (`pnpm api:export-openapi`); CI fails
  if the committed snapshot drifts from the server code.
- To add or change an API used by web/mobile: update the validation schema → the
  route → regenerate OpenAPI → update `packages/api-client` → update consumers →
  update tests.
- **Never** manually edit `services/api/openapi/openapi.json`; it is generated.
- Contract regressions on the client side are guarded by
  `packages/api-client/src/attendance-contract.test.ts` (asserts exact request
  method + path + query); expand it when adding id-bearing or query-driven
  client calls.

## Registry capability matrix

**Location of truth:** `REGISTRY_CAPABILITIES` in `packages/types/src/registry.ts`.
This documentation and the web UI must mirror it — the exported constant is
authoritative. Server-side enforcement happens in
`services/api/src/modules/registry/application/registry-service.ts` via
`AuthorizationService.requirePermission`; the web Registry page
(`apps/web/app/registry`) renders the same matrix for presentation only.
Client gating never substitutes for the server check (AGENTS.md §16, §65).

The matrix defines **who can register what** in the Registrations hub:

| Capability key | Entity registered | Required permission | Intended holders | Created record starts |
|---|---|---|---|---|
| `facility` | Welfare facility / project | `project:create` | Institution admins, authority officers | Pending (Draft → Pending Verification) |
| `organisation` | Agency / society | `organisation:create` | Authority officers | Active |
| `programme` | Scheme / programme | `programme:create` | Authority officers | Active |
| `inspector` | Inspector (user + role assignment) | `inspector:register` | Authority officers | Suspended until first sign-in |
| `official` | Authority official / admin (user + role + authority + jurisdiction) | `official:register` | System administrators only | Suspended until first sign-in |

Rules bound to the matrix:

1. **Server-authoritative.** Every registry route re-checks the permission
   listed here. A card hidden in the UI is a usability affordance; a 403 from
   the API is the enforcement.
2. **Fail closed.** Roles without a matrix permission see no registry card and
   receive 403 from the corresponding route. Custom roles must be granted the
   permission explicitly (Admin console).
3. **Registrable officials allow-list.** `POST /registry/officials` accepts
   only roles on the service-level allow-list (`authority_official`,
   `district_officer`, `institution_admin`, `inspector`, `viewer`). Requests
   for any other role are rejected with 403 — official registration cannot be
   used to mint unlisted privileged roles.
4. **Invited people start suspended.** Inspector and official registration
   create the user with `status: suspended`; there is no password at
   registration time. Activation happens through the normal authentication
   flow, never during registration.
5. **Seeded roles.** The deterministic seed (`supabase/seed/index.ts`) grants
   `organisation:create`, `programme:create`, `inspector:register` to
   `authority_officer`, and all four registry permissions to `system_admin`
   (implicitly, via its full permission list). No other seeded role carries
   registry permissions.
6. **Adding a capability.** Add the permission to `PERMISSIONS`
   (`packages/types/src/authorization.ts`), the capability to
   `REGISTRY_CAPABILITIES`, the route + service check, the seed grants, and a
   row here — in the same change.

The corresponding permission definitions (code, name, description) that the
seed inserts into the `permissions` table are part of the same contract; when
a permission is added, the seed's `permissionRows` and the role grant lists
must be updated together (AGENTS.md §13, §19).

## Registration verification (approval) flow

Facility registrations do not become operational on submission. The lifecycle
is `Draft → Pending Verification → Approved → Active ↔ Suspended → Closed →
Archived` (`PROJECT_TRANSITIONS` in `packages/types/src/project.ts` is the
authoritative chart; invalid transitions are rejected server-side).

**Who approves.** Any authenticated user holding `project:approve` whose
jurisdiction reach covers the project's district. The seeded
`authority_officer` and `system_admin` roles carry it; institution roles never
do — an institution cannot approve its own registration.

**Where.** The **Projects page** renders a verification-queue section at the
top for approvers only (`GET /projects/verification-queue`, scoped to the
caller's districts). Each row offers Approve / Reject plus a link into the
facility dossier, where `POST /projects/:id/transitions` (via the standard
`TransitionButton`) performs the same decision with an optional audit note.

**What happens next.**

- **Approve** (`Pending Verification → Approved`): requires `project:approve`
  in the project's district; the transition records `approved_by_id` and
  `approved_at`, writes a `project.transitioned` audit event and outbox event
  atomically. The registration then becomes Active through the normal
  lifecycle (Approved → Active).
- **Reject** (`Pending Verification → Draft`): a normal transition (`project:transition`);
  the registration returns to Draft for correction and resubmission. Nothing
  is deleted — history stays traceable (AGENTS.md §33).
- After approval the authority seals the facility **geofence**
  (`POST /projects/:id/geofence`, `project:approve`) and links programmes if
  not already linked; then the facility can be activated.

**Terminology note.** "Categories" and "types" are code-level enumerations,
not user-created records: project types (`institution`, `authority_project`,
`other`) and organisation categories are fixed constants in
`packages/types`/`packages/validation`, extended by developers through a
contract change. The registry creates *instances* (agencies, schemes,
facilities, people) — never new categories.

## Programme (scheme) geographic scope

Schemes differ in territorial reach; the scope is chosen at registration and
governs which facilities may link the scheme.

| Scope | Meaning | Required reference |
|---|---|---|
| `national` | Linkable from any facility | none |
| `state` | Only facilities inside one state | `stateId` |
| `district` | Only facilities in one district | `districtId` |

- Validation (`createProgrammeSchema` in `packages/validation`) enforces the
  scope/reference pairing at every boundary; the registry service re-checks
  existence and the registrar's territorial authority (state schemes require
  reach into the state's districts; district schemes require that district).
- `ProgrammeView.scopeLevel/stateId/districtId` expose the scope to clients;
  the registry UI shows a human-readable scope label (state/district name)
  next to each scheme.
- Seeded data demonstrates both: `PGM-NSP` is national, `PGM-SURPRISE` is
  Odisha-state-scoped.

## Territorial reference data

- `GET /registry/states` → `StateView[]` (`id`, `code`, `name`)
- `GET /registry/districts` → `DistrictView[]` (`id`, `code`, `name`,
  `stateId`, `stateName`)

Both require `project:read` and back the scheme-scope picker, the agency
home-district picker, and the official jurisdiction picker.
