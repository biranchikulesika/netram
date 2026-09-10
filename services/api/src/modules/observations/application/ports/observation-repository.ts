import type { AuditAction, DomainEventType, Observation, UUID } from "@netram/types";

export interface ObservationWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateObservationCommand extends ObservationWriteContext {
  id: UUID;
  inspectionId: UUID;
  userId: UUID;
  text: string;
}

export interface ObservationRepositoryPort {
  listByInspection(inspectionId: UUID): Promise<Observation[]>;
  createWithAuditAndEvent(cmd: CreateObservationCommand): Promise<Observation>;
}
