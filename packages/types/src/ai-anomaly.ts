import type { UUID, ISODateTime } from "./common.js";

/**
 * Detection kinds the camera-feed AI model can produce (§7, §36).
 *
 * Only driving detections enter here:
 * - `conflict`: violence/altercation detected in a camera feed (active).
 * - `attendance_deviation`: head count compared against the day's attendance
 *   register; sustained deviation over a long period raises an alert
 *   (planned — not yet produced by the model).
 *
 * Nothing other than these two is a supported AI detection today.
 */
export const ANOMALY_TYPES = [
  "conflict",
  "attendance_deviation",
] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const ANOMALY_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

export const ANOMALY_STATUSES = [
  "new",
  "reviewed",
  "dismissed",
  "investigated",
  "acted_upon",
] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

export const ANOMALY_TRANSITIONS: Record<AnomalyStatus, readonly AnomalyStatus[]> = {
  // §36: AI is advisory. New alerts are reviewed by authority, then either
  // dismissed, investigated, or acted upon.
  new: ["reviewed", "dismissed"],
  reviewed: ["investigated", "acted_upon", "dismissed"],
  investigated: ["acted_upon", "dismissed"],
  dismissed: [],
  acted_upon: [],
};

export interface AIAnomaly {
  id: UUID;
  inspectionId: UUID;
  evidenceId: UUID | null;
  type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  modelVersion: string | null;
  explanation: string | null;
  status: AnomalyStatus;
  reviewedBy: UUID | null;
  reviewedAt: ISODateTime | null;
  createdAt: ISODateTime;
  /** Project/district context joined at read time for jurisdiction scoping. */
  projectCode: string | null;
  projectName: string | null;
  districtId: UUID | null;
}

export interface AIAnomalyListQuery {
  type?: AnomalyType;
  severity?: AnomalySeverity;
  status?: AnomalyStatus;
  inspectionId?: UUID;
  page?: number;
  pageSize?: number;
}
