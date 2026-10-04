# ADR-003: Automating Complaint Escalation into Corrective Action Orders

**Status:** Accepted
**Date:** 2026-09-26

## Context

Netram's oversight workflow separates two primary entry points into
the accountability pipeline:

1. **Inspections** - evidence → findings → authority review → confirmed finding
   → corrective action ordered → ATR → verification → closure.
2. **Complaints** - a citizen or oversight input that may lead to review,
   request for explanation, escalation, inspection, or no action. A complaint
   is **not** confirmed misconduct.

Today the complaint lifecycle is
`received → under_review → escalated | resolved | closed` and the corrective
action lifecycle is always human-ordered: `createCorrectiveAction` requires a
**confirmed finding** and `inspection:review` permission. When an authority
escalates a complaint, the only automatic effect is a notification pulse to the
establishment's administrators (`complaint.escalated` → institution fan-out in
the outbox dispatcher, added in the institution-visibility change).

This leaves a manual gap: an escalated complaint that the authority judges
legitimate requires the officer to _also_ walk over to the inspections/finding
machinery and manufacture a finding record before any corrective action can be
ordered - even when the complaint's own documentation (attachments are hashed
and stored server-side) is the evidence the authority is acting on. The result
is either process theatre (rubber-stamp findings) or stalled accountability
(escalated complaints that die in a queue).

## Problem

How should a legitimate, escalated complaint produce an enforceable corrective
action without (a) diluting the "complaint ≠ guilt" rule, (b) letting
inspections become a formality, or (c) breaking the finding-based audit chain?

## Decision

Introduce a **complaint-derived corrective action** as a first-class, explicitly
labelled pathway - not a synthetic finding:

1. **New transition outcome.** Escalating a complaint gains an optional
   companion decision: `escalate + order corrective action`. The authority
   supplies a **reviewer's determination** (summary of why the complaint is
   substantiated). This is a human, permissioned decision
   (`complaint:resolve`), recorded verbatim in the audit trail.

2. **No synthetic findings.** The system does NOT fabricate an
   `InspectionFinding`. Findings remain exclusively inspection-derived, so
   inspection analytics, finding statistics, and the finding lifecycle stay
   truthful. Instead, `CorrectiveAction` gains a nullable, discriminated
   **source**: `inspection_finding` (existing, requires `findingId`) or
   `complaint` (requires `complaintId` + the determination text). The domain
   rule `canOrderCorrectiveAction` splits accordingly:
   - inspection pathway: unchanged (confirmed finding required);
   - complaint pathway: complaint must be in `escalated` status and the caller
     must hold `complaint:resolve` (they already must, to escalate).

3. **One order, one enforcement surface.** The ordered corrective action joins
   the _same_ lifecycle the institution already knows: notification pulse →
   Corrections section queue → ATR submission (`corrective_action:submit`) →
   authority verification → closure. No new institution-facing UI: the
   Corrections tab and action-inbox render complaint-sourced orders next to
   inspection-sourced ones, with a small provenance badge ("From complaint
   CMP-2026-XXXX").

4. **Disclosure unchanged.** The institution sees the corrective action (they
   must act on it) and the determination summary they are responding to - but
   never the complainant identity, contact info, or attachments per strict privacy
   and selective disclosure policy. The complaint record itself remains invisible to the subject.

5. **Complaint closure coupling.** The complaint can only be `resolved` when
   its derived corrective action(s) reach a terminal state (`verified` /
   `closed`). Closing the complaint while an order is pending is rejected with
   a conflict. This keeps "the grievance was addressed" from being claimed
   while the fix is still outstanding.

6. **Still not automatic.** The automation is _event plumbing and state
   coupling_, not an AI or rule-engine decision. The transition
   `under_review → escalated(+order)` remains a human decision by a
   permissioned authority officer; the system only enforces that the decision,
   the order, the pulse, and the closure coupling happen atomically and are
   audited together.

## Alternatives considered

- **Auto-create a confirmed finding from the complaint.** Rejected: collapses
  two distinct domain concepts, pollutes inspection-derived statistics,
  and makes "inspection found this" a lie in the audit trail.
- **Fully automatic ordering on escalation (no reviewer determination).**
  Rejected: encodes "complaint escalated = organisation guilty", which violates
  our core oversight principle; escalation can also mean "needs higher-level review",
  not "substantiated".
- **AI triage decides which complaints warrant orders.** Rejected for this
  decision: AI is strictly advisory. A rule-assisted _queue prioritisation_ may
  come later as a separate, advisory ADR.
- **Status quo (manual two-step).** Rejected: it incentivises rubber-stamp
  findings or lets escalated complaints stall; both are worse for the audit
  chain than an explicitly-labelled complaint-sourced order.

## Consequences

- **Schema:** `corrective_actions` gains nullable `source_type`
  (`inspection_finding` | `complaint`), nullable `complaint_id`, and a
  `determination_text` column for complaint-sourced orders. A migration is
  required; existing rows backfill to `source_type = 'inspection_finding'`.
- **Contracts:** OpenAPI + validation schemas for the escalate-and-order
  command; `CorrectiveAction` type gains the discriminated source union.
- **Workflow:** `transitionComplaint` may optionally create the order in the
  same atomic transaction (state change + audit + outbox); the existing
  `corrective_action.created` outbox event drives the institution pulse with
  zero dispatcher changes.
- **Enforcement:** `canSubmitAtr` and ATR verification logic are
  source-agnostic - they operate on the corrective action lifecycle only.
  The institution's duties do not change.
- **Auditability:** the determination text, the ordering officer, and the
  complaint linkage are permanent audit metadata; complaint closure is
  blocked while derived orders are pending.
- **Out of scope here:** inspection auto-scheduling from complaints (already
  exists via flags), AI-assisted triage, and citizen-facing status of the
  derived order (the public tracker keeps showing complaint-level status
  only).

## Related

- ADR-001 (modular monolith backend architecture)
- Domain specification: Inspection workflow, complaint escalation, transactional integrity, and information disclosure rules.
