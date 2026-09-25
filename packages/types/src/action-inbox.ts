import type { UUID, ISODateTime } from "./common.js";
import type { FindingSeverity } from "./finding.js";
import type { CorrectiveActionStatus } from "./corrective-action.js";
import type { ComplaintStatus } from "./complaint.js";
import type { AnomalySeverity } from "./ai-anomaly.js";
import type { AttendanceAnomalySeverity } from "./attendance.js";
import type { InspectionFlagRiskLevel } from "./fund.js";

/**
 * Action Inbox (AGENTS.md §32, §34).
 *
 * A unified, permission-gated queue of every item awaiting an authoritative
 * decision from the caller: approvals, reviews, verifications, and oversight
 * requests. The server decides what lands in the inbox — a section is included
 * only when the caller holds the permission that authorises the corresponding
 * action, and only within the caller's jurisdiction (§16, §17). The client
 * merely renders what the server discloses.
 *
 * Items disappear from the inbox automatically once the underlying workflow
 * moves past the decision point (state transition, verification, approval),
 * because each section queries only its "awaiting decision" state.
 */

/** Discriminator for the `kind` field — keep in sync with sections below. */
export const ACTION_INBOX_KINDS = [
  "project_verification",
  "finding_review",
  "corrective_action_review",
  "complaint_review",
  "ai_anomaly_review",
  "attendance_anomaly_review",
  "attendance_correction_approval",
  "expense_verification",
  "financial_document_verification",
  "inspection_flag_review",
] as const;

export type ActionInboxKind = (typeof ACTION_INBOX_KINDS)[number];

/**
 * What the authority can do with this item. `review` items resolve through
 * their workflow's review/transition endpoint; `approve` items resolve through
 * an approve/reject decision. Quick actions in the UI map to these.
 */
export type ActionInboxActionType = "approve" | "review";

export interface ActionInboxActor {
  id: UUID | null;
  name: string | null;
}

/** Contextual reference link the UI can deep-link to for the full dossier. */
export interface ActionInboxLink {
  /** Web-app route, e.g. "/dashboard/projects/abc". */
  href: string;
  label: string;
}

/**
 * One pending item. Field set is deliberately small and generic; module-specific
 * payloads that the deciding authority may see ride in `context` and are
 * assembled server-side under the same disclosure rules as the source module.
 */
export interface ActionInboxItem {
  id: UUID;
  kind: ActionInboxKind;
  /** "Approve registration", "Review finding", … (server-rendered label). */
  title: string;
  /** One-line explanation of what is being asked of the authority. */
  summary: string;
  actionType: ActionInboxActionType;
  /** Related facility, when the source module can resolve one. */
  project: {
    id: UUID | null;
    code: string | null;
    name: string | null;
    districtId: UUID | null;
  };
  /** When the item entered the queue (submission/receipt/detection time). */
  queuedAt: ISODateTime;
  /** Optional SLA deadline (corrective-action deadline, etc.). */
  deadline: ISODateTime | null;
  /** Severity/risk as assessed by the source module; absent where not applicable. */
  severity: string | null;
  /** Amount in INR for financially-relevant items, when disclosed. */
  amountInr: number | null;
  /** Who/what produced the item, when the source module discloses it. */
  actor: ActionInboxActor | null;
  /** Where the authority acts on the full dossier. */
  link: ActionInboxLink;
  /**
   * Module-specific extras for the decision surface (e.g. ATR summary for a
   * corrective action, dispute reason for an attendance correction, risk
   * explanation for a flag). Omitted fields are NOT sent rather than hidden.
   */
  context: Record<string, unknown>;
}

/** Canonical web route for each kind — single source for deep links. */
export const ACTION_INBOX_ROUTES: Record<ActionInboxKind, string> = {
  project_verification: "/dashboard/projects",
  finding_review: "/dashboard/inspections",
  corrective_action_review: "/dashboard/corrective-actions",
  complaint_review: "/dashboard/complaints",
  ai_anomaly_review: "/dashboard/control-room",
  attendance_anomaly_review: "/dashboard/control-room",
  attendance_correction_approval: "/dashboard/attendance",
  expense_verification: "/dashboard/funds",
  financial_document_verification: "/dashboard/funds",
  inspection_flag_review: "/dashboard/funds",
};

/**
 * Which permission gates each kind. Mirrors the source module's own guard so
 * the inbox can never surface a section the caller could not act on anyway.
 * "*" entries are pseudo-permissions filled at runtime (see
 * ACTION_INBOX_ALT_PERMISSIONS for kinds reachable via more than one grant).
 */
export const ACTION_INBOX_PERMISSIONS: Record<ActionInboxKind, string> = {
  project_verification: "project:approve",
  finding_review: "inspection:review",
  corrective_action_review: "corrective_action:approve",
  complaint_review: "complaint:resolve",
  ai_anomaly_review: "ai:anomaly:transition",
  attendance_anomaly_review: "attendance:anomaly:review",
  attendance_correction_approval: "attendance:correction:approve",
  expense_verification: "expense:verify",
  financial_document_verification: "financial_document:verify",
  inspection_flag_review: "inspection_flag:review",
};

/**
 * Alternate grants that also unlock a kind (checked as OR alongside the primary
 * permission). E.g. findings reach the review queue via inspection:review, and
 * corrective-action review also flows through inspection:review in the UI.
 */
export const ACTION_INBOX_ALT_PERMISSIONS: Partial<Record<ActionInboxKind, string[]>> = {
  finding_review: ["corrective_action:approve"],
};

export interface ActionInboxSection {
  kind: ActionInboxKind;
  /** Human title, e.g. "Registrations awaiting verification". */
  title: string;
  /** Permission that gates this section (informational, for the UI). */
  gatedBy: string;
  items: ActionInboxItem[];
  total: number;
}

export interface ActionInboxResponse {
  sections: ActionInboxSection[];
  /** Sum of section totals; the sidepanel badge count. */
  total: number;
  generatedAt: ISODateTime;
}

/* ---------- Re-exports used by the inbox payload assembly ---------- */

export type ActionInboxSeveritySource =
  | FindingSeverity
  | AnomalySeverity
  | AttendanceAnomalySeverity
  | InspectionFlagRiskLevel
  | CorrectiveActionStatus
  | ComplaintStatus
  | string;
