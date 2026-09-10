# Domain

Netram models its domain in distinct concepts (AGENTS.md §14). Do not collapse
them just because they happen to share fields.

```
User · Role · Permission · RoleAssignment · Authority · Jurisdiction
Organisation · Programme · Project · InspectionTeam · Inspector
Inspection · Finding · CorrectiveAction · Complaint · Evidence
Report · AIAnomaly · AuditEvent · DomainEvent
```

## Authority model

- **User** — who is acting (identity).
- **RoleAssignment** — a role granted to a user, optionally scoped to an
  authority, a jurisdiction, and with a set of permissions.
- **Permission** — an atomic capability (`project:create`, `project:approve`).
- **Jurisdiction** — geographic/district access control. A user may have
  authority in one district and none in another.
- **Scope** — `national` (unrestricted) or `jurisdiction`-limited.

Authorization is centralized (`AuthorizationService`) and re-evaluated
server-side on every request; never trust client-side UI hiding (AGENTS.md §16,
§34).

## Inspections

Inspectors observe and capture evidence. Authorities review findings and make
decisions. The mobile app never performs authority-level decisions
(AGENTS.md §32).

## Project lifecycle

```
Draft → Pending Verification → Approved → Active ↔ Suspended → Closed → Archived
```

Transitions are explicit, authorized, audited, and enforced by
`evaluateTransition` (`services/api/src/modules/projects/domain/project.ts`).
Invalid transitions are rejected.

## Events

`InspectionSubmitted`, `EvidenceCaptured`, `AIAnomalyDetected`,
`ProjectSuspended`, … are first-class domain events; durable publication uses
the outbox (`packages/data/src/db/schema.ts::outbox_events`,
`services/realtime/src/outbox-poller.ts`).
