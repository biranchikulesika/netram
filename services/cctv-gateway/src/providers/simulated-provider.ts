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
const samplesDir = path.resolve(__dirname,"../../samples");

export class SimulatedCameraProvider implements CameraProvider {
  readonly name = "simulated";

  private cameras: Map<string, CameraRef> = new Map([
    [
      "a8ccb317-76ab-5106-ac47-5bc1dc568967",
      {
        id: "cctv:vani-gate",
        label: "Vani Vihar - Main Gate",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "b488164c-0e08-585a-a5db-3ea2977ee28a",
      {
        id: "cctv:cuttack-dinning",
        label: "Cuttack Girls' Hostel - Dining Hall",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "6a2121e7-bf35-5fb8-aa13-a4a6ad7e2e36",
      {
        id: "cctv:vani-dormitory",
        label: "Vani Vihar - Dormitory Block",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "4e940f8a-2448-5174-a232-2d2712de95a9",
      {
        id: "cctv:vani-kitchen",
        label: "Vani Vihar - Kitchen Entry",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "bc0c4cf0-950b-584e-84e5-e056d7ac9eee",
      {
        id: "cctv:cuttack-gate",
        label: "Cuttack Girls' Hostel - Main Gate",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "e5780131-b007-579f-aa51-4eccc168fe39",
      {
        id: "cctv:ganjam-gate",
        label: "Ganjam Model School - Main Gate",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "18ba6d47-6879-559b-9e8d-e3e6ad783a5b",
      {
        id: "cctv:ganjam-kitchen",
        label: "Ganjam Model School - Kitchen",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "d39dc90f-b150-51cd-9072-d177421f8cad",
      {
        id: "cctv:rajdhani-gate",
        label: "Rajdhani Boys' Hostel - Main Gate",
        provider: "simulated",
        status: "online",
      },
    ],
    [
      "c79952b4-8322-5941-8cc4-fb6e3872b1c3",
      {
        id: "cctv:rourkela-gate",
        label: "Rourkela Model Girls' Hostel - Main Gate",
        provider: "simulated",
        status: "online",
      },
    ],
  ]);

  private samplePaths: Map<string, string> = new Map([
    ["a8ccb317-76ab-5106-ac47-5bc1dc568967", path.join(samplesDir,"boys-at-lab.mp4")],
    ["b488164c-0e08-585a-a5db-3ea2977ee28a", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
    ["6a2121e7-bf35-5fb8-aa13-a4a6ad7e2e36", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
    ["4e940f8a-2448-5174-a232-2d2712de95a9", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
    ["bc0c4cf0-950b-584e-84e5-e056d7ac9eee", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
    ["e5780131-b007-579f-aa51-4eccc168fe39", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
    ["18ba6d47-6879-559b-9e8d-e3e6ad783a5b", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
    ["d39dc90f-b150-51cd-9072-d177421f8cad", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
    ["c79952b4-8322-5941-8cc4-fb6e3872b1c3", path.join(samplesDir,"5977704-hd_1366_586_30fps.mp4")],
  ]);

  async listCameras(): Promise<CameraRef[]> {
    return Array.from(this.cameras.values());
  }

  async cameraHealth(cameraId: string): Promise<CameraRef["status"]> {
    if (this.cameras.has(cameraId)) {
      return this.cameras.get(cameraId)!.status;
    }
    return "online";
  }

  async acquireRawStream(cameraId: string): Promise<string> {
    const path = this.samplePaths.get(cameraId);
    if(!path){
      throw new Error(`No sample video configured for camera: ${cameraId}`);
    }
    return path;
  }

  async acquireSnapshot(_cameraId: string): Promise<CameraSnapshotResult> {
    return {
      contentType: "image/jpeg",
      data: MINIMAL_JPEG,
    };
  }
}
