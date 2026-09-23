import type { UUID, ISODateTime } from "./common.js";

export type CameraStatus = "active" | "inactive" | "maintenance";
export type CameraHealth = "online" | "offline" | "degraded" | "unknown";
export type StreamSessionStatus = "active" | "ended";

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
 */
export interface AuthorizedStream {
  streamId: string;
  cameraId: UUID;
  streamUrl: string;
  expiresAt: ISODateTime;
  token: string;
}

/**
 * Database record of an active or concluded streaming session in cctv_streams.
 */
export interface CctvStreamSession {
  id: UUID;
  cameraId: UUID;
  sessionId: string;
  status: StreamSessionStatus;
  startedAt: ISODateTime;
  endedAt: ISODateTime | null;
  createdAt: ISODateTime;
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
