# Shared Contracts

Cross-area contracts, their owners, and change protocols.

## Contract packages

| Package | Path | Purpose | Owner(s) |
|---------|------|---------|----------|
| `@netram/types` | `packages/types/src/` | Canonical domain and contract types (28 files) | @biranchikulesika @jyotirmaya2004 |
| `@netram/validation` | `packages/validation/src/` | Zod runtime validation schemas (26 files) | @biranchikulesika @jyotirmaya2004 |
| `@netram/api-client` | `packages/api-client/src/` | Typed HTTP client for the REST API | @biranchikulesika |
| `@netram/config` | `packages/config/src/` | Centralised validated environment configuration | @biranchikulesika |
| `@netram/data` | `packages/data/src/` | Repository interfaces and implementations | @biranchikulesika |

## Type files (`packages/types/src/`)

| File | Domain |
|------|--------|
| `auth.ts` | Authentication, `AuthenticatedUser`, `RequestUserContext` |
| `authorization.ts` | `Role`, `Permission`, `RoleAssignment`, `Scope`, `Policy` |
| `user.ts` | `User`, `UserProfile` |
| `geography.ts` | `State`, `District`, `Jurisdiction` |
| `project.ts` | `Project`, `ProjectStatus`, lifecycle transitions |
| `inspection.ts` | `Inspection`, `InspectionStatus`, workflow states |
| `inspection-assignment.ts` | `InspectionAssignment`, assignment rules |
| `finding.ts` | `Finding`, `FindingSeverity`, `FindingStatus` |
| `corrective-action.ts` | `CorrectiveAction`, `CorrectiveActionStatus` |
| `evidence.ts` | `Evidence`, `EvidenceIntegrityState`, `EvidenceUploadState` |
| `observation.ts` | `Observation`, `ObservationType` |
| `complaint.ts` | `Complaint`, `ComplaintStatus` |
| `notification.ts` | `Notification`, notification channels |
| `audit.ts` | `AuditEvent`, append-only audit trail |
| `ai-anomaly.ts` | `AIAnomaly`, `AnomalyScore`, `AnomalySeverity`, confidence |
| `attendance.ts` | `AttendanceCalculation`, `AttendanceAnomaly`, `AttendanceCorrection`, attendance estimation |
| `cctv.ts` | `PublicCctvCamera`, `CameraHealthStatus`, `AuthorizedStream` |
| `vc.ts` | `VideoConferenceSession`, `VCSessionStatus` |
| `domain-events.ts` | All domain event types (`InspectionAssigned`, `EvidenceCaptured`, etc.) |
| `common.ts` | Shared utilities (`UUID`, `Timestamp`, `Pagination`) |
| `sync.ts` | Offline sync types (`OfflineOperation`, `SyncResult`, `ConflictResult`) |
| `registry.ts` | Registry views, `REGISTRY_CAPABILITIES`, registration inputs |
| `fund.ts` | `FundAllocation`, `FundRelease`, `Expense`, `FinancialDocument`, `InspectionFlag` |
| `project-risk.ts` | `ProjectRiskSnapshot`, composite scoring types |
| `action-inbox.ts` | `ActionInboxItem`, `ActionInboxSection`, kind → permission registry |
| `scheme-component.ts` | `SchemeComponent` (DoSJE scheme components) |
| `project-photo.ts` | `ProjectPhoto` |
| `domain-events.ts` | All domain event types (`InspectionAssigned`, `EvidenceCaptured`, etc.) |

## Validation schemas (`packages/validation/src/`)

Each file corresponds to a type file and provides Zod schemas for runtime validation at API boundaries.

## API contract (OpenAPI)

- **Source of truth:** Route handlers in `services/api/src/modules/*/http/routes.ts` + processed validation schemas.
- **Exported format:** OpenAPI 3.1 JSON.
- **Export command:** `pnpm api:export-openapi`
- **Idempotency:** Verified — re-export produces identical SHA-1 checksum.
- **Canonical inventory:** `docs/contracts/README.md` (154 operations across 26 OpenAPI tags).
- **Client source of truth:** `packages/api-client/src/` (typed client generated from API patterns).

## Change protocol

### When you need to change a shared contract

1. **Identify impact:** Which areas consume this type/schema?
2. **Open a draft PR** with just the contract change (types + validation).
3. **Tag affected area owners** for review.
4. **Get approval** before merging.
5. **Update consumers** in the same PR or a follow-up PR (API routes, client calls, validation).
6. **Never merge** a contract change that breaks consumers without their knowledge.

### When you need to add a new domain type

1. Add the type to `packages/types/src/<domain>.ts`.
2. Add validation schema to `packages/validation/src/<domain>.ts`.
3. If it's a new API route, add the route handler in `services/api/src/modules/<module>/http/routes.ts`.
4. If the client needs it, update `packages/api-client/src/`.
5. Update `docs/contracts/README.md` with the new route (if API route).

### When you need to change the database schema

1. Update Drizzle schema in `packages/data/src/db/schema.ts`.
2. Generate migration: `pnpm db:generate`.
3. Reset local database: `pnpm db:setup`.
4. Update affected repositories in `packages/data/src/repositories/`.
5. Update affected types in `packages/types/src/` if needed.
6. Update validation if request/response shapes changed.
7. Re-export OpenAPI if API contract changed: `pnpm api:export-openapi`.

## Realtime event contract

Events published via WebSocket follow this shape:

```typescript
{
  event: "netram.event",
  data: {
    type: string;        // e.g. "evidence.captured", "inspection.submitted"
    id: string;          // outbox event ID
    occurredAt: string;  // ISO 8601 timestamp
    resourceType: string; // e.g. "evidence", "inspection"
    resourceId: string;   // resource UUID
    payload: Record<string, unknown>; // event-specific data
  }
}
```

Topic matching uses wildcard patterns:
- `*` — all events
- `evidence.*` — all evidence events
- `inspection.*` — all inspection events
- Exact match: `evidence.captured`

## Offline operation contract (mobile)

Operations submitted offline include:

```typescript
{
  operationId: string;    // client-generated UUID (idempotency key)
  operationType: string;  // e.g. "inspection.start", "evidence.capture"
  inspectionId: string;   // affected inspection
  payload: Record<string, unknown>; // operation-specific data
}
```

The server:
1. Authenticates the request.
2. Authorises the operation.
3. Validates the operation.
4. Compares against current state.
5. Accepts, rejects, or flags conflict.
6. Preserves the result for traceability.

Conflicts return `status: "conflict"` with a descriptive code. The client must not silently overwrite server state.
