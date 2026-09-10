/**
 * CCTV provider abstraction (AGENTS.md §42).
 *
 * The gateway owns provider-specific stream acquisition. The rest of Netram
 * talks to this interface — never to RTSP URLs, NVR vendors, or camera
 * credentials directly. Raw RTSP credentials must never reach browsers or
 * mobile clients; streams are re-served through an authorized relay.
 */
export interface CameraRef {
  id: string;
  label: string;
  provider: string;
  status: "online" | "offline" | "unknown";
}

export interface AuthorizedStream {
  /** Short-lived, signed relay URL valid only for the requesting session. */
  streamUrl: string;
  expiresAt: string;
}

export interface CameraSnapshotResult {
  contentType: string;
  data: Buffer;
}

export interface CameraProvider {
  readonly name: string;
  listCameras(): Promise<CameraRef[]>;
  cameraHealth(cameraId: string): Promise<CameraRef["status"]>;
  /**
   * Acquires the raw stream for the gateway's own processing pipeline.
   * Never exposed beyond this boundary.
   */
  acquireRawStream(cameraId: string): Promise<string>;
  /**
   * Captures an image snapshot frame from the camera stream for advisory AI
   * anomaly detection and inspection evidence assistance (§7, §36).
   */
  acquireSnapshot(cameraId: string): Promise<CameraSnapshotResult>;
}

/** Gateway contract. Implementations adapt specific NVR/vendor SDKs. */
export interface CctvGateway {
  canReach(cameraId: string): Promise<boolean>;
  requestAuthorizedStream(cameraId: string, ttlSeconds?: number): Promise<AuthorizedStream>;
}
