import type {
  DomainEventType,
  Inspection,
  InspectionListQuery,
  InspectionStatus,
} from "@netram/types";
import type { AuditAction } from "@netram/types";

export interface CreateInspectionCommand {
  id: string;
  projectId: string;
  templateId: string | null;
  disclosurePolicyId: string | null;
  type: Inspection["type"];
  trigger: Inspection["trigger"];
  scheduledStart: Date | string | null;
  scheduledEnd: Date | string | null;
  assigneeUserIds: string[];
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface TransitionInspectionCommand {
  inspectionId: string;
  to: InspectionStatus;
  note: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface InspectionListFilter extends InspectionListQuery {
  /** Jurisdictional scope: only inspections whose project's district is in this set. */
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

export interface InspectionRepositoryPort {
  findById(id: string): Promise<Inspection | null>;
  list(filter: InspectionListFilter): Promise<{ items: Inspection[]; total: number }>;
  createWithAuditAndEvent(cmd: CreateInspectionCommand): Promise<Inspection>;
  transitionWithAuditAndEvent(cmd: TransitionInspectionCommand): Promise<Inspection>;
}
