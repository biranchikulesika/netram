import type {
  CctvCamera,
  CctvStreamSession,
  CameraStatus,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface CctvWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CctvCameraListFilter {
  districtId?: string;
  status?: CameraStatus;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

export interface CctvRepositoryPort {
  findById(id: string): Promise<CctvCamera | null>;
  list(filter: CctvCameraListFilter): Promise<{ items: CctvCamera[]; total: number }>;
  createStreamSession(
    input: { id?: string; cameraId: string; sessionId: string },
    context: CctvWriteContext,
  ): Promise<CctvStreamSession>;
  endStreamSession(sessionId: string, context: CctvWriteContext): Promise<void>;
}
