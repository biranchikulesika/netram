import type { CameraProvider, CameraRef, CameraSnapshotResult } from "./provider.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Standard 1x1 valid JFIF JPEG buffer
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const samplesDir = path.resolve(__dirname, "../../samples");

/**
 * Simulated camera source (Phase 3 role change).
 *
 * NO LONGER a camera catalog and NO LONGER a media delivery mechanism. The
 * camera catalog lives in the NETRAM database (control plane); media delivery
 * is MediaMTX's job. This provider's remaining role is to RESOLVE the
 * simulated facility's ingest source for the dev rig: the gateway provisions
 * MediaMTX paths against it and MediaMTX pulls the RTSP feed that the
 * camera-sim container pushes into the facility NVR.
 */
export class SimulatedCameraProvider implements CameraProvider {
  readonly name = "simulated";

  /** The dev rig's single simulated facility feed (Phase 1–2 topology). */
  private readonly rigSource: string;

  constructor(rigSource = "rtsp://facility-nvr:8554/facility-vani/cam-gate") {
    this.rigSource = rigSource;
  }

  /**
   * No static catalog: the DB is the camera source of truth. The provider
   * reports no cameras of its own; cameras are described by camera context
   * passed from the control plane.
   */
  async listCameras(): Promise<CameraRef[]> {
    return [];
  }

  /**
   * Health is resolved from real media state by the MediaControlService —
   * a source resolver alone cannot know camera health.
   */
  async cameraHealth(_cameraId: string): Promise<CameraRef["status"]> {
    return "unknown";
  }

  /**
   * Resolve the simulated facility's ingest source URI (server-side only).
   * Any camera routed to the simulated provider pulls from the rig feed.
   */
  async acquireRawStream(_cameraId: string): Promise<string> {
    return this.rigSource;
  }

  async acquireSnapshot(_cameraId: string): Promise<CameraSnapshotResult> {
    return {
      contentType: "image/jpeg",
      data: MINIMAL_JPEG,
    };
  }

  /** Sample directory (used by tooling/tests only). */
  get samplesDir(): string {
    return samplesDir;
  }
}
