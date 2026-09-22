import type {
  AuditAction,
  DomainEventType,
  Finding,
  FindingStatus,
  FindingSeverity,
  UUID,
} from "@netram/types";

export interface FindingWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateFindingCommand extends FindingWriteContext {
  id: string;
  inspectionId: string;
  observationId: string | null;
  severity: FindingSeverity;
  description: string;
  remediation: string | null;
  categoryId: UUID | null;
  amountInr: number | null;
  responsibleOrganisationId: UUID | null;
}

export interface TransitionFindingCommand extends FindingWriteContext {
  findingId: string;
  to: FindingStatus;
  note: string | null;
}

export interface FindingRepositoryPort {
  listByInspection(inspectionId: string): Promise<Finding[]>;
  findById(id: string): Promise<Finding | null>;
  createWithAuditAndEvent(cmd: CreateFindingCommand): Promise<Finding>;
  transitionWithAuditAndEvent(cmd: TransitionFindingCommand): Promise<Finding>;
}
