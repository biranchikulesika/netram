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

export interface HlsCameraConfig {
  id: string;
  label: string;
  manifestUrl: string;
  snapshotUrl?: string;
  initialStatus?: "online" | "offline" | "unknown";
}

export interface HlsProviderOptions {
  fetchFn?: typeof fetch;
}

interface InternalHlsCamera {
  id: string;
  label: string;
  manifestUrl: string;
  snapshotUrl?: string;
  status: "online" | "offline" | "unknown";
}

/**
 * HLS (HTTP Live Streaming) Camera Provider Adapter (AGENTS.md §7, §42).
 *
 * Acquires streams from HLS/m3u8-enabled IP cameras, NVR transcoder endpoints,
 * or edge gateways.
 */
export class HlsCameraProvider implements CameraProvider {
  readonly name = "hls";

  private cameras: Map<string, InternalHlsCamera> = new Map();
  private fetchFn: typeof fetch;

  constructor(cameras: HlsCameraConfig[] = [], options: HlsProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    for (const c of cameras) {
      this.registerCamera(c);
    }
  }

  registerCamera(config: HlsCameraConfig): void {
    this.cameras.set(config.id, {
      id: config.id,
      label: config.label,
      manifestUrl: config.manifestUrl,
      snapshotUrl: config.snapshotUrl,
      status: config.initialStatus ?? "online",
    });
  }

  unregisterCamera(cameraId: string): boolean {
    return this.cameras.delete(cameraId);
  }

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
      throw new Error(`HLS Camera not found: ${cameraId}`);
    }
    return camera.manifestUrl;
  }

  async acquireSnapshot(cameraId: string): Promise<CameraSnapshotResult> {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`HLS Camera not found: ${cameraId}`);
    }

    if (camera.snapshotUrl) {
      try {
        const response = await this.fetchFn(camera.snapshotUrl, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const contentType = response.headers.get("content-type") ?? "image/jpeg";
          const arrayBuffer = await response.arrayBuffer();
          return {
            contentType,
            data: Buffer.from(arrayBuffer),
          };
        }
      } catch {
        // Fall back to minimal snapshot on network timeout/failure
      }
    }

    return {
      contentType: "image/jpeg",
      data: MINIMAL_JPEG,
    };
  }
}
