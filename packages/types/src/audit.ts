import type { UUID, ISODateTime } from "./common.js";

export const AUDIT_ACTIONS = [
  "auth.authenticated",
  "auth.authorization_failed",
  "project.created",
  "project.updated",
  "project.transitioned",
  "project.approved",
  "project.geofence_sealed",
  "project.photo_uploaded",
  "user.updated",
  "role.changed",
  "role.assignment_changed",
  "inspection.assigned",
  "inspection.created",
  "inspection.transitioned",
  "inspection.operation_accepted",
  "inspection.operation_rejected",
  "inspection.operation_conflict",
  "observation.created",
  "finding.created",
  "finding.transitioned",
  "corrective_action.created",
  "corrective_action.submitted",
  "corrective_action.accepted",
  "corrective_action.rejected",
  "corrective_action.updated",
  "corrective_action.overdue",
  "evidence.captured",
  "evidence.uploaded",
  "evidence.integrity_failed",
  "evidence.verified",
  "complaint.submitted",
  "complaint.updated",
  "complaint.escalated",
  "complaint.resolved",
  "complaint.closed",
  "ai.alert.reviewed",
  "ai.anomaly_reviewed",
  "ai.anomaly_dismissed",
  "ai.anomaly_investigated",
  "ai.anomaly_acted",
  "cctv.accessed",
  "cctv.stream_heartbeat",
  "cctv.stream_ended",
  "cctv.stream_revoked",
  "cctv.media_auth_denied",
  "cctv.session_swept",
  "vc.session_created",
  "vc.session_started",
  "vc.session_ended",
  "vc.participant_joined",
  "vc.participant_left",
  "scheduled_job.executed",
  "attendance.config_changed",
  "attendance.device_synced",
  "attendance.calculation_computed",
  "attendance.anomaly_detected",
  "attendance.anomaly_updated",
  "attendance.anomaly_reviewed",
  "attendance.anomaly_dismissed",
  "attendance.anomaly_false_positive",
  "attendance.anomaly_investigating",
  "attendance.anomaly_actioned",
  "attendance.individual_accessed",
  "attendance.correction_created",
  "attendance.correction_approved",
  "attendance.correction_rejected",
  "attendance.export_requested",
  "attendance.export_generated",
  "attendance.export_downloaded",
  "attendance.export_expired",
  "attendance.observation_recorded",
  "admin.action",
  "fund.allocation_created",
  "fund.allocation_revised",
  "fund.release_created",
  "fund.release_reversed",
  "expense.created",
  "expense.submitted",
  "expense.verified",
  "expense.rejected",
  "expense.voided",
  "financial_document.uploaded",
  "financial_document.verified",
  "financial_document.rejected",
  "financial_risk.rule_triggered",
  "financial_risk.flag_created",
  "financial_risk.flag_assigned",
  "financial_risk.flag_resolved",
  "financial_risk.flag_dismissed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEvent {
  id: UUID;
  action: AuditAction;
  actorUserId: UUID | null;
  resourceType: string | null;
  resourceId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: ISODateTime;
}

export interface AuditListQuery {
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: UUID;
  page?: number;
  pageSize?: number;
}
