/**
 * Audit activity formatter (client-side presentation layer).
 *
 *   raw audit event  →  formatAuditActivity()  →  human-readable activity model
 *
 * Every summary is generated from the actual `action` plus the metadata the
 * backend really writes (verified against the services/api application services
 * and the live `audit_events` table). When domain context is missing the
 * formatter degrades to a plain, honest summary — it never invents names,
 * roles or values.
 *
 * Category mapping mirrors the server's own event taxonomy
 * (`packages/types/src/audit.ts`) and matches `matchesCategory` in the view.
 */

import type { AuditEvent } from "@netram/types";

/**
 * The audit `action` column stores the writer's event vocabulary. Several
 * backend writers (and the seed) use the DomainEventType spelling, which is a
 * superset of `AuditAction` — so the formatter works on the raw string and
 * treats the typed const as advisory, never as the wire truth.
 */
type AuditActionLike = AuditEvent["action"] | (string & {});

/** Human-readable actor: role label + the account that performed the action. */
export interface AuditActor {
  /** Role line, e.g. "Authority Officer" or "Institution Account". */
  role: string;
  /** Account line, e.g. "Sruti (Officer, Khordha)" or "Vani Vihar Hostel Admin". */
  account: string;
  /** True when the acting account is an institution/organisation account. */
  isInstitution: boolean;
}

/** Fully presented audit activity, ready for the UI. */
export interface AuditActivity {
  /** Primary action summary, e.g. "New project created for Vani Vihar". */
  summary: string;
  /** Short status-style tag for the table, e.g. "Completed", "Rejected". */
  status: string;
  /** One of the UI tone classes (see getStatusTone). */
  tone: "routine" | "attention" | "critical" | "positive";
  /** Human-readable category, e.g. "Inspections". */
  category: string;
  /** Readable transition "Before → After" when the event is a state change. */
  transition: string | null;
  /** Human-readable description for the detail dialog (1–2 sentences). */
  detail: string;
  /** Extra key/value context rows for the dialog (only meaningful entries). */
  context: Array<{ label: string; value: string }>;
  /** Object/subject line for the dialog, e.g. the facility or camera. */
  subject: string | null;
}

/** Display name resolvers injected by the caller (page supplies user directory). */
export interface AuditFormatContext {
  /** userId → display name (from the users directory when available). */
  userNames?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* User/role labels (mirrors the seeded role vocabulary)               */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<string, string> = {
  system_admin: "System Administrator",
  authority_officer: "Authority Officer",
  control_room: "Control Room",
  institution_admin: "Institution Account",
  inspector: "Field Inspector",
  competent_authority: "Sanctioning Authority",
  programme_officer: "Programme Officer",
  auditor: "Authorized Auditor",
};

/** Seed user id → role code (the acting role each account operates). */
const USER_ROLE_CODES: Record<string, string> = {
  "8038000d-55cf-5adf-b415-d89f75c09ed5": "system_admin",
  "dce6caae-1730-5259-8331-8232d33c6030": "authority_officer",
  "3ea52f69-5873-59c8-b489-140e0e6ea66a": "authority_officer",
  "d2d244ef-d926-51f8-8b2e-6cd7cd977bd9": "control_room",
  "07806a3a-4951-5ee7-a56b-905ef915de9f": "institution_admin",
  "36abc3db-213f-5946-8d8c-ecfba4125116": "inspector",
  "49c82fb0-e07b-5ee1-8ed2-a81290da68f6": "inspector",
  "6988193f-09fc-5eda-af38-1be724ee76df": "inspector",
  "4c06937c-2907-5993-b25c-d2fd59d08ad2": "competent_authority",
  "d968dca5-a0a7-595b-9c22-6153c743422e": "programme_officer",
  "944dd943-303d-50ea-9a6f-fa63239e8821": "auditor",
  "ac9cc514-c113-53a7-8d7f-dda7cbcc1123": "institution_admin",
};

const ROLE_CODES: Record<string, string> = {
  system_admin: "Authority",
  authority_officer: "Authority",
  control_room: "Authority",
  institution_admin: "Institute",
  inspector: "Authority",
  competent_authority: "Authority",
  programme_officer: "Authority",
  auditor: "Authority",
};

function roleCodeForUser(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return USER_ROLE_CODES[userId] ?? null;
}

/**
 * Resolves the actor for an audit event. NETRAM's account model (§19 of the
 * activity spec): institution/project/organisation accounts act as the
 * institution itself — the account is the actor, not a person. A display name
 * (which may name the responsible operator) is shown as the account line.
 */
export function resolveActor(
  event: AuditEvent,
  ctx: AuditFormatContext = {},
): AuditActor | null {
  if (!event.actorUserId) return null; // system/sweeper-driven
  const roleCode = roleCodeForUser(event.actorUserId);
  // Resolved from the injected user directory; a viewer without it sees the role.
  const name = ctx.userNames?.[event.actorUserId] ?? "Officer";
  const isInstitution = roleCode === "institution_admin";
  return {
    role: roleCode ? (ROLE_LABELS[roleCode] ?? roleCode) : "Officer",
    account: name,
    isInstitution,
  };
}

/** Compact side label for the actor cell: "Authority" / "Institute". */
export function actorSide(event: AuditEvent): string | null {
  const roleCode = roleCodeForUser(event.actorUserId);
  return roleCode ? (ROLE_CODES[roleCode] ?? null) : null;
}

/* ------------------------------------------------------------------ */
/* Category mapping                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Activity",
  inspections: "Inspections",
  remediations: "Remediation",
  grievances: "Grievances",
  facilities: "Facilities",
  security: "Access & Accounts",
  surveillance: "Surveillance & AI",
  attendance: "Attendance",
  finance: "Funds & Finance",
  jobs: "System Jobs",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function categoryForAction(action: AuditActionLike): string {
  if (action.startsWith("scheduled_job.")) return "jobs";
  if (
    action.startsWith("inspection.") ||
    action.startsWith("finding.") ||
    action.startsWith("observation.") ||
    action.startsWith("evidence.")
  ) {
    return "inspections";
  }
  if (action.startsWith("corrective_action.")) return "remediations";
  if (action.startsWith("complaint.")) return "grievances";
  if (action.startsWith("project.")) return "facilities";
  if (
    action.startsWith("auth.") ||
    action.startsWith("user.") ||
    action.startsWith("role.") ||
    action.startsWith("admin.")
  ) {
    return "security";
  }
  if (action.startsWith("cctv.") || action.startsWith("ai.") || action.startsWith("vc.")) {
    return "surveillance";
  }
  if (action.startsWith("attendance.")) {
    return "attendance";
  }
  if (
    action.startsWith("fund.") ||
    action.startsWith("expense.") ||
    action.startsWith("financial_document.") ||
    action.startsWith("financial_risk.")
  ) {
    return "finance";
  }
  return "jobs";
}

/* ------------------------------------------------------------------ */
/* Status tone + label (restrained; reuses existing badge classes)      */
/* ------------------------------------------------------------------ */

export function getStatusTone(event: AuditEvent): AuditActivity["tone"] {
  const a: string = event.action;
  if (
    a.includes("failed") ||
    a.includes("rejected") ||
    a.includes("overdue") ||
    a.includes("authorization_failed") ||
    a.includes("denied") ||
    a.includes("voided") ||
    a.includes("reversed")
  ) {
    return "critical";
  }
  if (
    a.includes("anomaly") ||
    a.includes("escalated") ||
    a.includes("conflict") ||
    a.includes("suspended")
  ) {
    return "attention";
  }
  if (
    a.includes("approved") ||
    a.includes("accepted") ||
    a.includes("resolved") ||
    a.includes("verified") ||
    a.includes("completed") ||
    a.includes("closed")
  ) {
    return "positive";
  }
  return "routine";
}

function statusLabelFor(event: AuditEvent): string {
  const a: string = event.action;
  const to = typeof event.metadata?.to === "string" ? event.metadata.to : null;
  if (to) return humanizeEnum(to);
  if (a.endsWith(".approved") || a.includes("approved")) return "Approved";
  if (a.includes("rejected")) return "Rejected";
  if (a.includes("accepted")) return "Accepted";
  if (a.includes("resolved")) return "Resolved";
  if (a.includes("verified")) return "Verified";
  if (a.includes("integrity_failed") || a.includes("failed")) return "Failed";
  if (a.includes("denied")) return "Denied";
  if (a.includes("overdue")) return "Overdue";
  if (a.includes("escalated")) return "Escalated";
  if (a.includes("suspended")) return "Suspended";
  if (a.includes("closed")) return "Closed";
  if (a.includes("ended")) return "Ended";
  if (a.includes("submitted")) return "Submitted";
  if (a.includes("created") || a.includes(".started") || a.includes("accessed")) return "New";
  return "Recorded";
}

function humanizeEnum(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Summary generation — one branch per real backend action family      */
/* ------------------------------------------------------------------ */

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** subject: the project/facility a summary should attach to, when known. */
function projectSubject(event: AuditEvent): string | null {
  // Project audit events carry the project's own name/code. Never guess a name
  // from the UUID: an unknown subject stays absent rather than becoming fiction.
  // Bare `name`/`code` are only read on project events — on inspection events
  // `code` is the inspection reference (e.g. "INS-1"), not a facility.
  return (
    str(event.metadata?.projectName) ??
    str(event.metadata?.projectCode) ??
    (event.resourceType === "project"
      ? (str(event.metadata?.name) ?? str(event.metadata?.code))
      : null)
  );
}

interface SummaryInput {
  event: AuditEvent;
  subject: string | null;
  code: string | null;
}

function buildSummary({ event, subject }: SummaryInput): string {
  const a: string = event.action;
  const forFacility = subject ? ` for ${subject}` : "";
  const atFacility = subject ? ` at ${subject}` : "";
  // Corrective-action events name the finding they address, which is the only
  // thing that makes "overdue" or "escalated" meaningful to a reader.
  const finding = str(event.metadata?.finding);
  const aboutFinding = finding ? ` — ${finding}` : "";

  switch (a) {
    /* Security & accounts */
    case "auth.authenticated":
      return "Signed in";
    case "auth.authorization_failed":
      return "Blocked an unauthorized access attempt";
    case "user.updated":
      return "Account details updated";
    case "role.changed":
      return "Role permissions updated";
    case "role.assignment_changed":
      return "Role assignment updated";
    case "admin.action":
      return "Administrative action performed";

    /* Facilities / projects */
    case "project.created":
      return subject ? `New project registered${forFacility}` : "New project registered";
    case "project.updated":
      return subject ? `Project details updated${forFacility}` : "Project details updated";
    case "project.transitioned": {
      const to = str(event.metadata?.to);
      return to
        ? `Project status updated to ${humanizeEnum(to)}`
        : "Project status updated";
    }
    case "project.approved":
      return subject ? `Project approved${forFacility}` : "Project approved";
    case "project.submitted_for_verification":
      return "Project submitted for verification";
    case "project.geofence_sealed":
      return subject ? `Facility geofence sealed${forFacility}` : "Facility geofence sealed";
    case "project.photo_uploaded":
      return "Facility photo uploaded";
    case "project.suspended":
      return subject ? `Project suspended${forFacility}` : "Project suspended";

    /* Inspections */
    case "inspection.created":
      return subject ? `Inspection scheduled${atFacility}` : "Inspection scheduled";
    case "inspection.assigned":
      return subject ? `Inspection assigned${atFacility}` : "Inspection assigned";
    case "inspection.started":
      return subject ? `Inspection started${atFacility}` : "Inspection started";
    case "inspection.submitted":
      return subject
        ? `Inspection report submitted${forFacility}`
        : "Inspection report submitted";
    case "inspection.closed":
      return subject ? `Inspection closed${atFacility}` : "Inspection closed";
    case "inspection.transitioned": {
      const to = str(event.metadata?.to);
      return to ? `Inspection ${humanizeEnum(to)}` : "Inspection status updated";
    }
    case "inspection.operation_accepted":
      return "Offline inspection record accepted";
    case "inspection.operation_rejected":
      return "Offline inspection record rejected";
    case "inspection.operation_conflict":
      return "Offline inspection record conflicted";
    case "inspection.findings_recorded":
      return subject ? `Findings recorded${atFacility}` : "Findings recorded";
    case "observation.created":
      return "Observation recorded";
    case "finding.created":
      return "Finding recorded";
    case "finding.transitioned": {
      const to = str(event.metadata?.to);
      return to ? `Finding marked ${humanizeEnum(to)}` : "Finding status updated";
    }

    /* Corrective actions (ATR) */
    case "corrective_action.created":
      return `Corrective action ordered${aboutFinding}`;
    case "corrective_action.submitted":
      return subject
        ? `Action Taken Report submitted${forFacility}${aboutFinding}`
        : `Action Taken Report submitted${aboutFinding}`;
    case "corrective_action.accepted":
      return `Action Taken Report accepted${aboutFinding}`;
    case "corrective_action.rejected":
      return `Action Taken Report rejected${aboutFinding}`;
    case "corrective_action.updated":
      return `Corrective action updated${aboutFinding}`;
    case "corrective_action.overdue":
      return `Corrective action overdue${aboutFinding}`;
    case "corrective_action.escalated":
      return `Corrective action escalated${aboutFinding}`;

    /* Evidence */
    case "evidence.captured":
      return "Evidence captured in the field";
    case "evidence.uploaded":
      return "Evidence uploaded";
    case "evidence.verified":
      return "Evidence integrity verified";
    case "evidence.integrity_failed":
      return "Evidence integrity check failed";

    /* Complaints */
    case "complaint.submitted":
    case "complaint.received":
      return subject ? `Complaint submitted${forFacility}` : "Complaint submitted";
    case "complaint.updated":
      return "Complaint updated";
    case "complaint.escalated":
      return "Complaint escalated";
    case "complaint.resolved":
      return "Complaint resolved";
    case "complaint.closed":
      return "Complaint closed";

    /* Surveillance & AI */
    case "cctv.accessed":
      return subject ? `CCTV stream accessed${atFacility}` : "CCTV stream accessed";
    case "cctv.stream_heartbeat":
      return "CCTV stream kept active";
    case "cctv.stream_ended":
      return "CCTV stream ended";
    case "cctv.stream_revoked":
      return "CCTV stream revoked";
    case "cctv.media_auth_denied":
      return "Blocked an unauthorized stream request";
    case "cctv.session_swept":
      return "Idle CCTV session closed";
    case "ai.anomaly_reviewed":
      return "AI alert reviewed";
    case "ai.anomaly_dismissed":
      return "AI alert dismissed";
    case "ai.anomaly_investigated":
      return "AI alert escalated for investigation";
    case "ai.anomaly_acted":
      return "Action recorded on AI alert";
    case "ai.alert.reviewed":
      return "AI alert reviewed";

    /* Video conferencing */
    case "vc.session_created":
      return "Video conference scheduled";
    case "vc.session_started":
      return "Video conference started";
    case "vc.session_ended":
      return "Video conference ended";
    case "vc.participant_joined":
      return "Participant joined video conference";
    case "vc.participant_left":
      return "Participant left video conference";

    /* Attendance */
    case "attendance.config_changed":
      return "Attendance configuration changed";
    case "attendance.device_synced":
      return "Attendance device synced";
    case "attendance.calculation_computed":
      return "Attendance calculated";
    case "attendance.anomaly_detected":
      return "Attendance anomaly detected";
    case "attendance.anomaly_reviewed":
      return "Attendance anomaly reviewed";
    case "attendance.anomaly_dismissed":
    case "attendance.anomaly_false_positive":
      return "Attendance anomaly dismissed";
    case "attendance.anomaly_investigating":
      return "Attendance anomaly under investigation";
    case "attendance.anomaly_actioned":
      return "Action taken on attendance anomaly";
    case "attendance.anomaly_updated":
      return "Attendance anomaly updated";
    case "attendance.individual_accessed":
      return "Individual attendance record viewed";
    case "attendance.correction_created":
      return "Attendance correction requested";
    case "attendance.correction_approved":
      return "Attendance correction approved";
    case "attendance.correction_rejected":
      return "Attendance correction rejected";
    case "attendance.export_requested":
      return "Attendance export requested";
    case "attendance.export_generated":
      return "Attendance export generated";
    case "attendance.export_downloaded":
      return "Attendance export downloaded";
    case "attendance.export_expired":
      return "Attendance export expired";
    case "attendance.observation_recorded":
      return "Attendance observation recorded";

    /* Funds & finance */
    case "fund.allocation_created":
      return "Funds allocated";
    case "fund.allocation_revised":
      return "Fund allocation revised";
    case "fund.release_created":
      return "Fund release created";
    case "fund.release_reversed":
      return "Fund release reversed";
    case "expense.created":
      return "Expense recorded";
    case "expense.submitted":
      return "Expense submitted";
    case "expense.verified":
      return "Expense verified";
    case "expense.rejected":
      return "Expense rejected";
    case "expense.voided":
      return "Expense voided";
    case "financial_document.uploaded":
      return "Financial document uploaded";
    case "financial_document.verified":
      return "Financial document verified";
    case "financial_document.rejected":
      return "Financial document rejected";
    case "financial_risk.rule_triggered":
      return "Financial risk rule triggered";
    case "financial_risk.flag_created":
      return "Financial risk flag raised";
    case "financial_risk.flag_assigned":
      return "Financial risk flag assigned";
    case "financial_risk.flag_resolved":
      return "Financial risk flag resolved";
    case "financial_risk.flag_dismissed":
      return "Financial risk flag dismissed";

    /* System */
    case "scheduled_job.executed":
      return "Scheduled job executed";

    default:
      // Honest fallback for actions added to the backend before this formatter.
      return humanizeEnum(a.split(".")[1] ?? a);
  }
}

/* ------------------------------------------------------------------ */
/* Detail + context for the dialog                                     */
/* ------------------------------------------------------------------ */

function buildDetail(input: SummaryInput): string {
  const { event, subject } = input;
  const a: string = event.action;

  const from = str(event.metadata?.from);
  const to = str(event.metadata?.to);
  if (from && to) {
    const what = a.startsWith("project.")
      ? `${subject ?? "The project"} project status`
      : a.startsWith("inspection.")
        ? "Inspection stage"
        : a.startsWith("corrective_action.")
          ? "Corrective action status"
          : a.startsWith("complaint.")
            ? "Complaint status"
            : "Record status";
    return `${what} was changed from ${humanizeEnum(from)} to ${humanizeEnum(to)}.`;
  }

  const reason = str(event.metadata?.reason);
  if (a.includes("denied") || a.includes("authorization_failed")) {
    return reason
      ? `The request was denied: ${reason.replace(/_/g, " ")}.`
      : "The request was denied by the authorisation layer.";
  }
  if (a === "project.suspended") {
    return reason
      ? `The project was suspended: ${reason.replace(/_/g, " ")}.`
      : "The project was suspended.";
  }

  const findings = event.metadata?.findings;
  if (typeof findings === "number") {
    return `The inspection closed with ${findings} finding${findings === 1 ? "" : "s"} recorded.`;
  }

  const attachmentCount = event.metadata?.attachmentCount;
  if (typeof attachmentCount === "number" && attachmentCount > 0) {
    return `Submitted with ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}.`;
  }

  return "";
}

function buildContext(input: SummaryInput, actor: AuditActor | null): AuditActivity["context"] {
  const { event, subject, code } = input;
  const ctx: AuditActivity["context"] = [];

  if (code) ctx.push({ label: "Reference", value: code });
  if (subject && code) ctx.push({ label: "Facility / project", value: subject });
  if (subject && !code && event.resourceType !== "project") {
    ctx.push({ label: "Facility / project", value: subject });
  }

  const tracking = str(event.metadata?.trackingCode);
  if (tracking) ctx.push({ label: "Tracking code", value: tracking });

  const inspectionType = str(event.metadata?.inspectionType) ?? str(event.metadata?.type);
  if (inspectionType && event.action.startsWith("inspection.")) {
    ctx.push({ label: "Inspection type", value: humanizeEnum(inspectionType) });
  }

  const surprise = event.metadata?.surprise;
  if (surprise === true) ctx.push({ label: "Trigger", value: "Surprise inspection" });

  const trigger = str(event.metadata?.trigger);
  if (trigger && event.action.startsWith("inspection.")) {
    ctx.push({ label: "Trigger", value: humanizeEnum(trigger) });
  }

  const inspector = str(event.metadata?.inspector);
  if (inspector) ctx.push({ label: "Assigned inspector", value: inspector });

  const cameraId = str(event.metadata?.cameraId);
  const cameraName = str(event.metadata?.cameraName);
  if (cameraId) {
    ctx.push({
      label: "Camera",
      value: cameraName ? `${cameraName} (${cameraId.slice(0, 8)}…)` : cameraId.slice(0, 8) + "…",
    });
  }

  const mediaPath = str(event.metadata?.mediaPath);
  if (mediaPath) ctx.push({ label: "Stream path", value: mediaPath });

  const endReason = str(event.metadata?.endReason);
  if (endReason) ctx.push({ label: "Ended because", value: humanizeEnum(endReason) });

  const anomalyType = str(event.metadata?.anomalyType);
  if (anomalyType) ctx.push({ label: "Signal type", value: humanizeEnum(anomalyType) });

  const evidenceType = str(event.metadata?.evidenceType);
  if (evidenceType) ctx.push({ label: "Evidence type", value: humanizeEnum(evidenceType) });

  if (actor) {
    ctx.push({
      label: actor.isInstitution ? "Account" : "Performed by",
      value: actor.isInstitution ? actor.account : `${actor.account} — ${actor.role}`,
    });
  }

  return ctx;
}

/** Resource code carried in metadata (`code`) or the reference itself. */
function referenceCode(event: AuditEvent): string | null {
  return str(event.metadata?.code) ?? str(event.metadata?.trackingCode);
}

/** Full presentation of one audit event. */
export function formatAuditActivity(
  event: AuditEvent,
  ctx: AuditFormatContext = {},
): AuditActivity {
  const subject = projectSubject(event);
  const code = referenceCode(event);
  const input: SummaryInput = { event, subject, code };
  const actor = resolveActor(event, ctx);

  const transitionRaw =
    str(event.metadata?.from) && str(event.metadata?.to)
      ? `${humanizeEnum(str(event.metadata?.from) ?? "")} → ${humanizeEnum(str(event.metadata?.to) ?? "")}`
      : null;

  return {
    summary: buildSummary(input),
    status: statusLabelFor(event),
    tone: getStatusTone(event),
    category: categoryForAction(event.action),
    transition: transitionRaw,
    detail: buildDetail(input),
    context: buildContext(input, actor),
    subject,
  };
}

export type TimeRangePreset =
  | "all"
  | "30m"
  | "1h"
  | "12h"
  | "24h"
  | "3d"
  | "7d"
  | "30d"
  | "custom";

export const TIME_RANGE_PRESETS: Array<{ id: Exclude<TimeRangePreset, "custom">; label: string }> = [
  { id: "all", label: "All time" },
  { id: "30m", label: "Last 30 minutes" },
  { id: "1h", label: "Last 1 hour" },
  { id: "12h", label: "Last 12 hours" },
  { id: "24h", label: "Last 24 hours" },
  { id: "3d", label: "Last 3 days" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

/**
 * Evaluates whether an audit event falls within the requested time preset or custom date range.
 */
export function matchesTimeRange(
  occurredAt: string,
  preset: TimeRangePreset,
  customStart?: string,
  customEnd?: string,
  nowMs: number = Date.now(),
): boolean {
  const eventMs = new Date(occurredAt).getTime();
  if (Number.isNaN(eventMs)) return true;

  if (customStart) {
    const startMs = new Date(`${customStart}T00:00:00`).getTime();
    if (!Number.isNaN(startMs) && eventMs < startMs) return false;
  }
  if (customEnd) {
    const endMs = new Date(`${customEnd}T23:59:59.999`).getTime();
    if (!Number.isNaN(endMs) && eventMs > endMs) return false;
  }

  if (preset === "all" || preset === "custom") return true;

  const durationMap: Record<Exclude<TimeRangePreset, "all" | "custom">, number> = {
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  const ms = durationMap[preset];
  if (!ms) return true;

  return eventMs >= nowMs - ms;
}


