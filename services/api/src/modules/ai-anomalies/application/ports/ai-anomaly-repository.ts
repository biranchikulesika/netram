import type { AIAnomaly, AnomalyStatus, AuditAction, DomainEventType, UUID } from "@netram/types";

export interface AiAnomalyWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface TransitionAiAnomalyCommand extends AiAnomalyWriteContext {
  anomalyId: UUID;
  to: AnomalyStatus;
  reviewedBy: UUID;
  reviewedAt: Date;
}

export interface AiAnomalyListFilter {
  type?: string;
  severity?: string;
  status?: AnomalyStatus;
  inspectionId?: UUID;
  jurisdictionIds?: UUID[];
  page: number;
  pageSize: number;
}

export interface AiAnomalyRepositoryPort {
  list(filter: AiAnomalyListFilter): Promise<{ items: AIAnomaly[]; total: number }>;
  findById(id: UUID): Promise<AIAnomaly | null>;
  transitionWithAuditAndEvent(cmd: TransitionAiAnomalyCommand): Promise<AIAnomaly>;
}
