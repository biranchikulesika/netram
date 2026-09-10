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
5. Information disclosure is server-side: unauthorized fields are **omitted**,
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

### Corrective Actions

- `GET /corrective-actions`
- `POST /corrective-actions`
- `GET /corrective-actions/:id`
- `POST /corrective-actions/:id/transitions`

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

### Reports

- `GET /reports`
- `POST /reports`
- `GET /reports/:id`
- `POST /reports/:id/finalize`

### User Administration

- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `POST /users/:id/role-assignments`
- `DELETE /role-assignments/:id`
- `GET /roles`
- `PUT /roles/:id/permissions`

### Realtime

- `POST /realtime/authorize`

### CCTV

- `GET /cctv/cameras`
- `GET /cctv/cameras/:id`
- `GET /cctv/cameras/:id/health`
- `POST /cctv/cameras/:id/streams`
- `GET /cctv/cameras/:id/snapshot`

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
