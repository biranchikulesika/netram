import type { CameraProvider, CameraRef, CameraSnapshotResult } from "./provider.js";

// Standard 1x1 valid JFIF JPEG buffer for snapshot fallback
const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9,
]);

export interface RtspCameraConfig {
  id: string;
  label: string;
  rtspUrl: string;
  snapshotUrl?: string;
  initialStatus?: "online" | "offline" | "unknown";
}

export interface RtspProviderOptions {
  fetchFn?: typeof fetch;
}

interface InternalRtspCamera {
  id: string;
  label: string;
  rtspUrl: string;
  snapshotUrl?: string;
  status: "online" | "offline" | "unknown";
}

/**
 * Strips basic/digest credentials from an RTSP URL to prevent credential leakage.
 */
export function sanitizeRtspUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    // If URL parsing fails, regex strip any user:pass@ pattern
    return url.replace(/\/\/([^@]+)@/, "//");
  }
}

/**
 * RTSP / NVR Camera Provider Adapter (AGENTS.md §7, §42).
 *
 * Acquires streams from generic RTSP cameras and Network Video Recorders (NVRs).
 * Enforces server-side credential isolation: raw RTSP credentials stay within the
 * gateway service and are never exposed to clients.
 */
export class RtspCameraProvider implements CameraProvider {
  readonly name = "rtsp";

  private cameras: Map<string, InternalRtspCamera> = new Map();
  private fetchFn: typeof fetch;

  constructor(cameras: RtspCameraConfig[] = [], options: RtspProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    for (const c of cameras) {
      this.registerCamera(c);
    }
  }

  /**
   * Registers or updates an RTSP camera in the adapter.
   */
  registerCamera(config: RtspCameraConfig): void {
    this.cameras.set(config.id, {
      id: config.id,
      label: config.label,
      rtspUrl: config.rtspUrl,
      snapshotUrl: config.snapshotUrl,
      status: config.initialStatus ?? "online",
    });
  }

  /**
   * Unregisters an RTSP camera from the adapter.
   */
  unregisterCamera(cameraId: string): boolean {
    return this.cameras.delete(cameraId);
  }

  /**
   * Updates operational health status of an RTSP camera.
   */
  updateCameraStatus(cameraId: string, status: "online" | "offline" | "unknown"): void {
    const camera = this.cameras.get(cameraId);
    if (camera) {
      camera.status = status;
    }
  }

  async listCameras(): Promise<CameraRef[]> {
    return Array.from(this.cameras.values()).map((cam) => ({
      id: cam.id,
      label: cam.label,
      provider: this.name,
      status: cam.status,
    }));
  }

  async cameraHealth(cameraId: string): Promise<CameraRef["status"]> {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      return "offline";
    }
    return camera.status;
  }

  async acquireRawStream(cameraId: string): Promise<string> {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`RTSP Camera not found: ${cameraId}`);
    }
    return camera.rtspUrl;
  }

  async acquireSnapshot(cameraId: string): Promise<CameraSnapshotResult> {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`RTSP Camera not found: ${cameraId}`);
    }

    if (camera.snapshotUrl) {
      try {
        const response = await this.fetchFn(camera.snapshotUrl, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          const contentType = response.headers.get("content-type") ?? "image/jpeg";
          const arrayBuffer = await response.arrayBuffer();
          return {
            contentType,
            data: Buffer.from(arrayBuffer),
          };
        }
      } catch {
        // Fall back to minimal snapshot on network failure
      }
    }

    return {
      contentType: "image/jpeg",
      data: MINIMAL_JPEG,
    };
  }
}
