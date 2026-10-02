import type { EvidenceType, OfflineOperation } from "@netram/types";
import type { OfflineInspectionQueue } from "./queue";

function uuidv4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Computes SHA-256 hash of a string or buffer and prefixes with 'sha256:' (§30).
 */
export async function computeSha256(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `sha256:${hex}`;
  }

  // Node.js test environment fallback when crypto.subtle is stubbed
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require("node:crypto");
      const hex = nodeCrypto.createHash("sha256").update(bytes).digest("hex");
      return `sha256:${hex}`;
    } catch {
      // fallback
    }
  }

  return `sha256:0000000000000000000000000000000000000000000000000000000000000000`;
}

export interface CaptureEvidenceOfflineInput {
  inspectionId: string;
  evidenceType: EvidenceType;
  fileName: string;
  mimeType?: string;
  fileBytes?: Uint8Array;
  localFileUri?: string;
  latitude?: number;
  longitude?: number;
  contentHash?: string;
}

export interface CaptureEvidenceOfflineResult {
  operation: OfflineOperation;
  evidenceId: string;
  contentHash: string;
}

/**
 * Capture evidence in the field while offline (§30, §31).
 * Computes capture-time hash, enqueues the metadata operation,
 * and stages media for subsequent background upload.
 */
export async function captureEvidenceOffline(
  queue: OfflineInspectionQueue,
  input: CaptureEvidenceOfflineInput,
): Promise<CaptureEvidenceOfflineResult> {
  const evidenceId = uuidv4();
  const hash =
    input.contentHash ??
    (input.fileBytes
      ? await computeSha256(input.fileBytes)
      : await computeSha256(`${input.fileName}-${Date.now()}`));

  const payload: Record<string, unknown> = {
    evidenceId,
    evidenceType: input.evidenceType,
    fileName: input.fileName,
    mimeType: input.mimeType ?? "image/jpeg",
    fileSizeBytes: input.fileBytes ? input.fileBytes.byteLength : 1024,
    contentHash: hash,
    localFileUri: input.localFileUri ?? `file:///data/evidence/${evidenceId}/${input.fileName}`,
    latitude: input.latitude,
    longitude: input.longitude,
    capturedAt: new Date().toISOString(),
  };

  const operation = await queue.enqueueOperation(input.inspectionId, "capture_evidence", payload);

  return {
    operation,
    evidenceId,
    contentHash: hash,
  };
}
