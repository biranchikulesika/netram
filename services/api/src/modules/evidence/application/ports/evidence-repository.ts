import type {
  AuditAction,
  DomainEventType,
  Evidence,
  EvidenceIntegrityState,
  EvidenceType,
  UUID,
} from "@netram/types";

export interface EvidenceWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CaptureEvidenceCommand extends EvidenceWriteContext {
  id: UUID;
  inspectionId: UUID;
  findingId: UUID | null;
  capturedAt: Date;
  latitude: number | null;
  longitude: number | null;
  evidenceType: EvidenceType;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  deviceId: string | null;
}

export interface UpdateEvidenceCommand extends EvidenceWriteContext {
  evidenceId: UUID;
  contentHash?: string;
  storageKey?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  integrityTo?: EvidenceIntegrityState;
}

export interface VerifyIntegrityCommand extends EvidenceWriteContext {
  evidenceId: UUID;
  to: EvidenceIntegrityState;
}

export interface EvidenceRepositoryPort {
  listByInspection(inspectionId: UUID): Promise<Evidence[]>;
  findById(id: UUID): Promise<Evidence | null>;
  captureWithAuditAndEvent(cmd: CaptureEvidenceCommand): Promise<Evidence>;
  markUploadedWithAuditAndEvent(cmd: UpdateEvidenceCommand): Promise<Evidence>;
  verifyIntegrityWithAuditAndEvent(cmd: VerifyIntegrityCommand): Promise<Evidence>;
}
