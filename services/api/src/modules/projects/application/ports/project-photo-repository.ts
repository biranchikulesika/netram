import type { AuditAction, DomainEventType, ProjectPhoto, UUID } from "@netram/types";

export interface ProjectPhotoWriteContext {
  actorUserId: UUID | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateProjectPhotoCommand extends ProjectPhotoWriteContext {
  id: UUID;
  projectId: UUID;
  uploadedBy: UUID;
  capturedAt: Date;
  caption: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  contentHash: string;
  storageKey: string;
}

export interface ProjectPhotoRepositoryPort {
  createWithAuditAndEvent(cmd: CreateProjectPhotoCommand): Promise<ProjectPhoto>;
  listByProject(projectId: UUID): Promise<ProjectPhoto[]>;
  findById(id: UUID): Promise<ProjectPhoto | null>;
}
