import type {
  CctvCamera,
  CctvStreamSession,
  CameraStatus,
  StreamEndReason,
  StreamEndedBy,
  AuditAction,
  DomainEventType,
} from "@netram/types";

/** Who/what drove a session end (Phase 4). */
export interface EndStreamAttributes {
  endedBy: StreamEndedBy;
  endReason: StreamEndReason;
}

/** Sweeper candidate: active session that should be ended. */
export interface SweepCandidate {
  id: string;
  sessionId: string | null;
  cameraId: string;
  mediaPath: string | null;
  reason: StreamEndReason;
}

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
    input: {
      id?: string;
      cameraId: string;
      sessionId: string;
      mediaPath?: string;
      tokenHash?: string;
      expiresAt?: string;
    },
    context: CctvWriteContext,
  ): Promise<CctvStreamSession>;
  endStreamSession(
    sessionId: string,
    context: CctvWriteContext,
    input?: EndStreamAttributes,
  ): Promise<void>;
  touchHeartbeatBySessionId(sessionId: string): Promise<boolean>;
  findActiveSessionByTokenHash(tokenHash: string): Promise<CctvStreamSession | null>;
  findActiveSessionBySessionId(sessionId: string): Promise<CctvStreamSession | null>;
  countActiveByCamera(cameraId: string): Promise<number>;
  findSweepCandidates(now: Date, graceMs: number): Promise<SweepCandidate[]>;
  endStreamSessionById(
    id: string,
    context: CctvWriteContext,
    input: EndStreamAttributes,
  ): Promise<boolean>;
}
