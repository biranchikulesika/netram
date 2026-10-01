import type { UUID, ISODateTime } from "./common.js";

export type CameraStatus = "active" | "inactive" | "maintenance";
export type CameraHealth = "online" | "offline" | "degraded" | "unknown";
export type StreamSessionStatus = "active" | "ended";

/** Who drove a session's end (Phase 4 lifecycle). */
export type StreamEndedBy = "viewer" | "sweeper" | "admin";

/** Why a session ended (Phase 4 vocabulary - docs/history/cctv-phase-4.md). */
export type StreamEndReason =
  "viewer_stop" | "token_expired" | "heartbeat_timeout" | "admin_revoke";

/**
 * Authoritative CCTV Camera entity stored in PostgreSQL (§42).
 * Includes raw endpoint/credentials used exclusively within the gateway/service tier.
 */
export interface CctvCamera {
  id: UUID;
  name: string;
  provider: string;
  protocol: string;
  endpoint: string;
  districtId: UUID | null;
  /** Monitored target this camera watches; exact attribution, not name-matched. */
  projectId: UUID | null;
  status: CameraStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * Client-facing sanitized representation of a CCTV Camera.
 * Explicitly OMITS the raw camera endpoint and credentials (§7, §42).
 */
export interface PublicCctvCamera {
  id: UUID;
  name: string;
  provider: string;
  protocol: string;
  districtId: UUID | null;
  /** Monitored target this camera watches; enables exact project links. */
  projectId: UUID | null;
  status: CameraStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * Health check status returned by the CCTV gateway.
 */
export interface CameraHealthStatus {
  cameraId: UUID;
  status: CameraHealth;
  latencyMs?: number;
  lastCheckedAt: ISODateTime;
  details?: Record<string, unknown>;
}

/**
 * Short-lived authorized stream relay delivered to clients (§7, §42).
 * Clients connect to the signed streamUrl rather than raw RTSP streams.
 *
 * `playback` (Phase 3+) is the media-plane contract: WHEP URL + playback
 * token scoped to a MediaMTX path. Never contains RTSP URLs or credentials.
 */
export interface AuthorizedStream {
  streamId: string;
  cameraId: UUID;
  streamUrl: string;
  expiresAt: ISODateTime;
  token: string;
  playback?: {
    protocol: "webrtc";
    whepUrl: string;
    token: string;
    mediaPath: string;
  };
}

/**
 * Database record of an active or concluded streaming session in cctv_streams.
 * Phase 4 adds the lifecycle fields: heartbeat, token hash, end attribution.
 */
export interface CctvStreamSession {
  id: UUID;
  cameraId: UUID;
  sessionId: string;
  status: StreamSessionStatus;
  startedAt: ISODateTime;
  endedAt: ISODateTime | null;
  createdAt: ISODateTime;
  /** MediaMTX path the playback token is scoped to (media-plane contract). */
  mediaPath: string | null;
  lastHeartbeatAt: ISODateTime | null;
  expiresAt: ISODateTime | null;
  endedBy: StreamEndedBy | null;
  endReason: StreamEndReason | null;
}

/**
 * Snapshot frame captured from CCTV feed for AI anomaly detection / attendance estimation (§7).
 */
/** Input for POST /cameras/:id/streams/heartbeat. */
export interface StreamHeartbeatInput {
  /** Client WHEP session id, when available (MediaMTX session UUID). */
  whepSessionId?: string;
}

/** Input for DELETE /cameras/:id/streams/:streamId (admin/viewer stop). */
export interface EndStreamInput {
  endReason: "viewer_stop" | "admin_revoke";
}

/**
 * Snapshot frame captured from CCTV feed for AI anomaly detection / attendance estimation (§7).
 */
export interface CameraSnapshot {
  cameraId: UUID;
  timestamp: ISODateTime;
  format: "jpeg" | "png";
  contentType: string;
  contentHash?: string;
  dataBase64?: string;
}

export interface ListCamerasFilter {
  districtId?: UUID;
  status?: CameraStatus;
  page?: number;
  pageSize?: number;
}

/** Result of a playback-token verification (external auth hook + dev tools). */
export interface StreamTokenVerification {
  valid: boolean;
  streamId: string;
  cameraId: UUID;
  mediaPath: string;
  expiresAt: ISODateTime;
}

/** Live MediaMTX reader/viewer state for a session (Phase 4). */
export interface StreamViewerState {
  sessionId: string;
  mediaPath: string;
  readerCount: number;
  state: "idle" | "read";
  lastHeartbeatAt: ISODateTime | null;
}
