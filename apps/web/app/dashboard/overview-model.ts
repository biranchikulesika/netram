/**
 * Dashboard overview model (presentation logic, no I/O).
 *
 * The overview answers four questions and nothing else:
 *   1. What needs attention?
 *   2. What is the current state?
 *   3. What recently changed?
 *   4. What is happening next?
 *
 * Everything here is a pure function over data the page already fetched, so the
 * rules that decide "needs attention" are unit-testable rather than buried in JSX.
 */

import type { AIAnomaly, Complaint, CorrectiveAction, Inspection, Project } from "@netram/types";

/** How loudly an exception should shout. Red is reserved for `critical`. */
export type AttentionSeverity = "critical" | "high" | "medium";

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  /** Facility name, or the record name when no facility is resolvable. */
  title: string;
  /** What is wrong, in one plain sentence. */
  reason: string;
  /** Supporting detail: dates, confidence, deadlines. */
  meta: string | null;
  href: string;
}

export interface UpcomingItem {
  id: string;
  projectName: string;
  /** "Routine" / "Surprise" / "Follow-up", from the inspection type. */
  kind: string;
  when: string;
  href: string;
}

/** Stable keys for each overview metric, used to pair a count with its readability. */
export type StateMetricId =
  "facilities" | "active" | "inspections" | "openComplaints" | "attention";

export interface StateMetric {
  id: StateMetricId;
  label: string;
  value: number;
  href: string;
  /** Only the exception count earns emphasis; everything else stays neutral. */
  highlight: boolean;
  /**
   * False when the API refused the underlying list. The count is then unknown,
   * not zero, and the UI must not present it as a figure.
   */
  readable: boolean;
}

/**
 * One line of recent activity, already humanised by the shared audit
 * formatter. Carries no actor identity: the overview reports what changed to
 * the monitored estate, not who changed it.
 */
export type ActivityEntry = {
  id: string;
  summary: string;
  subject: string | null;
  status: string;
  tone: "routine" | "attention" | "critical" | "positive";
  occurredAt: string;
};

export interface OverviewData {
  projects: Project[];
  inspections: Inspection[];
  /** Overdue corrective actions only; the page requests that status explicitly. */
  overdueActions: CorrectiveAction[];
  /** Complaints that are not yet resolved or closed. */
  complaints: Complaint[];
  /** Unreviewed anomalies; severity is narrowed for display, not for the query. */
  anomalies: AIAnomaly[];
  /**
   * True counts from the API, each scoped by a status filter where one exists.
   * Deliberately never derived from a fetched page, so no number on screen is a
   * sample dressed up as a portfolio total.
   */
  totals: {
    projects: number;
    activeProjects: number;
    inspections: number;
    openComplaints: number;
  };
}

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { critical: 0, high: 1, medium: 2 };

/** Complaints the authority still owes an outcome to. */
const OPEN_COMPLAINT_STATUSES = new Set(["received", "under_review", "escalated"]);
/** Inspections that have been scheduled but not yet carried out. */
const PENDING_INSPECTION_STATUSES = new Set(["assigned", "scheduled"]);

function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Keeps an attention row to one scannable line. */
function clip(text: string | null | undefined, max = 160): string {
  const trimmed = (text ?? "").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function ms(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function wholeDaysBetween(fromMs: number, toMs: number): number {
  return Math.max(0, Math.floor((toMs - fromMs) / 86_400_000));
}

/** "3 hours ago" / "2 days ago" — the age phrasing used across the overview. */
export function relativeAge(iso: string | null | undefined, nowMs: number): string | null {
  const then = ms(iso);
  if (then === null || then > nowMs) return null;
  const hours = Math.floor((nowMs - then) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** Most recent completed inspection date per project, for staleness context. */
function lastInspectionByProject(inspections: Inspection[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const inspection of inspections) {
    const stamp = inspection.submittedAt;
    const at = ms(stamp);
    if (at === null) continue;
    const current = ms(latest.get(inspection.projectId));
    if (current === null || at > current) latest.set(inspection.projectId, stamp as string);
  }
  return latest;
}

export function buildAttention(data: OverviewData, nowMs: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  const lastInspection = lastInspectionByProject(data.inspections);

  /* Critical and high surveillance alerts that nobody has reviewed yet. */
  for (const anomaly of data.anomalies) {
    if (anomaly.status !== "new") continue;
    if (anomaly.severity !== "critical" && anomaly.severity !== "high") continue;
    items.push({
      id: `anomaly-${anomaly.id}`,
      severity: anomaly.severity === "critical" ? "critical" : "high",
      title: anomaly.projectName ?? "Surveillance alert",
      // The written explanation is the specific reason; the bare type is not.
      reason: clip(anomaly.explanation) || `${humanise(anomaly.type)} detected`,
      // Age, not confidence: a model score is not evidence of anything, and
      // the severity badge already states the band.
      meta:
        relativeAge(anomaly.createdAt, nowMs) === null
          ? null
          : `Detected ${relativeAge(anomaly.createdAt, nowMs)}`,
      href: "/dashboard/control-room",
    });
  }

  /* Corrective actions past their statutory deadline. */
  for (const action of data.overdueActions) {
    if (action.status !== "overdue") continue;
    const due = ms(action.deadline);
    const facility = action.project?.name ?? "Corrective action";
    items.push({
      id: `ca-${action.id}`,
      severity: "high",
      title: facility,
      reason: "Corrective action past its deadline",
      meta: due === null ? null : `Due ${wholeDaysBetween(due, nowMs)} days ago`,
      href: action.project
        ? `/dashboard/corrective-actions/${action.id}`
        : "/dashboard/corrective-actions",
    });
  }

  /* Complaints still awaiting an outcome. */
  for (const complaint of data.complaints) {
    if (!OPEN_COMPLAINT_STATUSES.has(complaint.status)) continue;
    const reason =
      complaint.status === "escalated"
        ? "Complaint escalated to the state authority"
        : complaint.status === "under_review"
          ? "Complaint under review"
          : "New complaint awaiting triage";
    items.push({
      id: `complaint-${complaint.id}`,
      severity: complaint.status === "escalated" ? "high" : "medium",
      title: complaint.projectName,
      reason,
      meta: `Received ${relativeAge(complaint.receivedAt, nowMs) ?? "recently"}`,
      href: `/dashboard/complaints/${complaint.id}`,
    });
  }

  /* Scheduled inspections whose start date has passed without work beginning. */
  for (const inspection of data.inspections) {
    if (!PENDING_INSPECTION_STATUSES.has(inspection.status)) continue;
    const start = ms(inspection.scheduledStart);
    if (start === null || start > nowMs) continue;
    items.push({
      id: `inspection-${inspection.id}`,
      severity: "medium",
      title: inspection.projectName,
      reason: `${humanise(inspection.type)} not started`,
      meta: `Scheduled ${relativeAge(inspection.scheduledStart, nowMs)}`,
      href: `/dashboard/inspections/${inspection.id}`,
    });
  }

  /* Facilities whose lifecycle state itself demands a decision. */
  for (const project of data.projects) {
    if (project.status !== "Suspended" && project.status !== "Pending Verification") continue;
    const seen = relativeAge(lastInspection.get(project.id), nowMs);
    items.push({
      id: `project-${project.id}`,
      severity: project.status === "Suspended" ? "high" : "medium",
      title: project.name,
      reason:
        project.status === "Suspended" ? "Facility suspended" : "Awaiting verification approval",
      meta: seen ? `Last inspection ${seen}` : "No completed inspection on record",
      href: `/dashboard/projects/${project.id}`,
    });
  }

  return items
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title),
    )
    .slice(0, 8);
}

export function buildUpcoming(inspections: Inspection[], nowMs: number): UpcomingItem[] {
  return inspections
    .filter((inspection) => PENDING_INSPECTION_STATUSES.has(inspection.status))
    .map((inspection) => ({ inspection, at: ms(inspection.scheduledStart) }))
    .filter(
      (entry): entry is { inspection: Inspection; at: number } =>
        entry.at !== null && entry.at >= nowMs,
    )
    .sort((a, b) => a.at - b.at)
    .slice(0, 6)
    .map(({ inspection, at }) => ({
      id: inspection.id,
      projectName: inspection.projectName,
      kind: humanise(inspection.type),
      when: relativeDayLabel(at, nowMs),
      href: `/dashboard/inspections/${inspection.id}`,
    }));
}

/** "Tomorrow" / "4 Oct" — the phrasing used in the upcoming table. */
export function relativeDayLabel(atMs: number, nowMs: number): string {
  const days = wholeDaysBetween(nowMs, atMs);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return new Date(atMs).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Which source lists the signed-in user was actually allowed to read. */
export type ReadableSources = Record<StateMetricId, boolean>;

export function summariseState(
  data: OverviewData,
  attentionCount: number,
  readable: ReadableSources,
): StateMetric[] {
  return [
    {
      id: "facilities",
      label: "Facilities monitored",
      value: data.totals.projects,
      href: "/dashboard/projects",
      highlight: false,
      readable: readable.facilities,
    },
    {
      id: "active",
      label: "Of those, active",
      value: data.totals.activeProjects,
      href: "/dashboard/projects",
      highlight: false,
      readable: readable.active,
    },
    {
      id: "inspections",
      label: "Inspections on record",
      value: data.totals.inspections,
      href: "/dashboard/inspections",
      highlight: false,
      readable: readable.inspections,
    },
    {
      id: "openComplaints",
      label: "Unresolved complaints",
      value: data.totals.openComplaints,
      href: "/dashboard/complaints",
      highlight: false,
      readable: readable.openComplaints,
    },
    {
      id: "attention",
      label: "Items needing action",
      value: attentionCount,
      href: "#needs-attention",
      highlight: attentionCount > 0,
      // Attention is assembled from several lists; a partial estate would
      // under-report, so treat any refusal as "unknown".
      readable: Object.values(readable).every(Boolean),
    },
  ];
}

/**
 * Activity categories that represent real operational work. Sign-ins, role
 * changes and scheduled-job chatter are excluded: the overview reports what
 * happened to the monitored estate, not what the software did internally.
 */
const ACTIVITY_CATEGORIES = new Set([
  "inspections",
  "remediations",
  "grievances",
  "facilities",
  "surveillance",
  "attendance",
  "finance",
]);

export function isOperationalCategory(category: string): boolean {
  return ACTIVITY_CATEGORIES.has(category);
}
