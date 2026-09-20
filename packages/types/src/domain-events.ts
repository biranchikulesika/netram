import type { UUID, ISODateTime } from "./common.js";

export const DOMAIN_EVENT_TYPES = [
  "project.created",
  "project.updated",
  "project.status_transitioned",
  "project.approved",
  "project.suspended",
  "project.geofence_sealed",
  "project.photo_uploaded",
  "inspection.assigned",
  "inspection.created",
  "inspection.started",
  "inspection.submitted",
  "inspection.status_transitioned",
  "inspection.operation_accepted",
  "inspection.operation_rejected",
  "inspection.operation_conflict",
  "observation.created",
  "finding.created",
  "finding.confirmed",
  "finding.dismissed",
  "corrective_action.created",
  "corrective_action.submitted",
  "corrective_action.accepted",
  "corrective_action.rejected",
  "corrective_action.review_started",
  "evidence.captured",
  "evidence.uploaded",
  "evidence.integrity_failed",
  "evidence.verified",
  "complaint.submitted",
  "complaint.updated",
  "complaint.escalated",
  "complaint.resolved",
  "complaint.closed",
  "corrective_action.overdue",
  "ai.anomaly_detected",
  "ai.anomaly_reviewed",
  "ai.anomaly_dismissed",
  "ai.anomaly_investigated",
  "ai.anomaly_acted",
  "notification.created",
  "report.requested",
  "report.generated",
  "user.status_changed",
  "user.role_assigned",
  "user.role_unassigned",
  "role.permissions_changed",
  "cctv.stream_started",
  "cctv.stream_ended",
  "vc_session.created",
  "vc_session.started",
  "vc_session.ended",
  "vc_session.participant_joined",
  "vc_session.participant_left",
  "attendance.event_received",
  "attendance.event_normalized",
  "attendance.window_calculated",
  "attendance.data_quality_changed",
  "attendance.anomaly_detected",
  "attendance.anomaly_updated",
  "attendance.anomaly_reviewed",
  "attendance.anomaly_dismissed",
  "attendance.anomaly_false_positive",
  "attendance.anomaly_investigating",
  "attendance.anomaly_actioned",
  "attendance.correction_created",
  "attendance.correction_approved",
  "attendance.export_requested",
  "attendance.export_completed",
  "attendance.export_expired",
  "attendance.individual_accessed",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

/**
 * Durable outbox/domain event envelope.
 * Payloads must be minimal and must not contain sensitive information.
 */
export interface DomainEventEnvelope {
  id: UUID;
  type: DomainEventType;
  correlationId: string;
  occurredAt: ISODateTime;
  actorUserId: UUID | null;
  resourceType: string;
  resourceId: string;
  /** Minimal, non-sensitive context. */
  payload: Record<string, unknown>;
}

export interface OutboxRecord extends DomainEventEnvelope {
  status: "pending" | "processed" | "failed";
  attemptCount: number;
  availableAfter: ISODateTime | null;
  lastError: string | null;
  processedAt: ISODateTime | null;
}
