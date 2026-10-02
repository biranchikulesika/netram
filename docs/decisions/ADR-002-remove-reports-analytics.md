# ADR-002: Remove Reports and Analytics Domains

**Status:** Accepted
**Date:** 2026-09-23

## Context

Netram shipped two derived/aggregate features that overlapped with existing
capabilities and added persistent complexity:

- **Reports** (`/reports`): derived per-inspection report artefacts produced by
  a dedicated BullMQ worker, with a lifecycle
  (`requested → generating → ready → failed → finalized`), a `reports` table,
  a job queue, and web pages.
- **Analytics** (`/analytics/overview`): an authority-level aggregate overview
  (SLA compliance, deficiency recurrence) computed by a read-only repository
  over live tables, plus web pages.

Both were duplicated presentation-oriented views over data already exposed
through inspections, findings, corrective actions, and the project risk engine
(`composite_risk_snapshots`), which remains the strategic oversight surface.

## Problem

- Maintaining a second derived-artefact pipeline (report worker, artefact
  storage, finalisation immutability) for output the project risk engine and
  inspection records already provide.
- Aggregate analytics logic duplicated KPI computations with no independent
  consumer, and its permission surface (`report:read/generate/finalize`)
  polluted the authorisation model.
- Every domain addition had to be reflected in report snapshots, increasing
  cross-module coupling for no statutory requirement.

## Decision

Remove the Reports and Analytics domains entirely:

- Delete `services/api/src/modules/reports` and `services/api/src/modules/analytics`,
  the report worker, and the report job queue.
- Drop the `reports` table (migration `0015_drop_reports.sql`). Analytics had
  no dedicated persistence.
- Remove `Report*`/`Analytics*` types, validation schemas, repositories, API
  client methods, `report:*` permissions, `report.*` domain/audit events, web
  pages, and navigation entries.
- Inspection records remain the authoritative source; the **project risk
  engine** and **attendance exports** remain the aggregate/derived surfaces
  where oversight output is needed.

## Alternatives Considered

- **Keep reports, add formats (PDF/docx):** rejected - investment in a retired
  presentation layer while statutory output is already served by inspection
  evidence bundles and corrective-action ATR files.
- **Keep analytics, rename to dashboards:** rejected - same coupling, same
  duplication; the control room and project risk views already answer the
  oversight questions.

## Consequences

- The `reports` table is dropped; any historical report artefacts in object
  storage become unreachable through the product (they were derived, never
  authoritative - no truth is lost).
- `report:read`, `report:generate`, `report:finalize` permissions and
  `report.*` audit/domain event types no longer exist. Audit rows referencing
  `report.*` actions from before the migration remain append-only history.
- Route count decreases; the OpenAPI contract is regenerated accordingly.
