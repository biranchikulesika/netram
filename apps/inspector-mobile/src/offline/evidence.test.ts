import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeSha256, captureEvidenceOffline } from "./evidence";
import { OfflineInspectionQueue } from "./queue";
import { InMemorySqliteDatabase, setTestDatabase } from "./db";

describe("Evidence Offline & Digest (P14-03)", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionId = "insp-evidence-test-456";

  beforeEach(async () => {
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);
  });

  describe("computeSha256", () => {
    it("computes SHA-256 hash matching known NIST/standard vector for known string", async () => {
      // Known SHA-256 of "hello world"
      // b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
      const result = await computeSha256("hello world");
      expect(result).toBe("sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    });

    it("computes SHA-256 hash correctly when given Uint8Array bytes", async () => {
      const bytes = new TextEncoder().encode("hello world");
      const result = await computeSha256(bytes);
      expect(result).toBe("sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    });

    it("computes hash via Node fallback path when crypto.subtle is unavailable", async () => {
      const originalCrypto = globalThis.crypto;
      try {
        vi.stubGlobal("crypto", { subtle: undefined });
        const result = await computeSha256("hello world");
        expect(result).toBe("sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
      } finally {
        vi.stubGlobal("crypto", originalCrypto);
      }
    });
  });

  describe("captureEvidenceOffline", () => {
    it("enqueues capture_evidence operation and stages metadata with fileBytes", async () => {
      const fileBytes = new TextEncoder().encode("Sample foundation image data");
      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "foundation-inspection.jpg",
        mimeType: "image/jpeg",
        fileBytes,
        latitude: 28.6139,
        longitude: 77.209,
      });

      expect(result.evidenceId).toBeDefined();
      expect(result.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(result.operation.type).toBe("capture_evidence");

      const pending = await queue.getPendingOperations();
      expect(pending).toHaveLength(1);
      const op = pending[0]!;
      expect(op.payload.evidenceId).toBe(result.evidenceId);
      expect(op.payload.contentHash).toBe(result.contentHash);
      expect(op.payload.fileSizeBytes).toBe(fileBytes.byteLength);
      expect(op.payload.latitude).toBe(28.6139);
      expect(op.payload.longitude).toBe(77.209);
      expect(op.payload.mimeType).toBe("image/jpeg");
    });

    it("uses provided contentHash when explicitly passed", async () => {
      const explicitHash = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "document",
        fileName: "approval-notice.pdf",
        mimeType: "application/pdf",
        contentHash: explicitHash,
      });

      expect(result.contentHash).toBe(explicitHash);
      const pending = await queue.getPendingOperations();
      expect(pending[0]?.payload.contentHash).toBe(explicitHash);
      expect(pending[0]?.payload.mimeType).toBe("application/pdf");
    });

    it("generates fallback hash and stores local file URI when fileBytes not provided", async () => {
      const customUri = "file:///custom/cache/path/doc.pdf";
      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "document",
        fileName: "doc.pdf",
        localFileUri: customUri,
      });

      expect(result.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      const pending = await queue.getPendingOperations();
      expect(pending[0]?.payload.localFileUri).toBe(customUri);
      expect(pending[0]?.payload.fileSizeBytes).toBe(1024);
    });

    it("supports capturing voice note as audio evidence linked with observation note", async () => {
      const voiceBytes = new TextEncoder().encode("Voice note audio recording data");
      const audioResult = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "audio",
        fileName: "voice-note-test.m4a",
        mimeType: "audio/m4a",
        fileBytes: voiceBytes,
      });

      expect(audioResult.evidenceId).toBeDefined();
      expect(audioResult.operation.type).toBe("capture_evidence");

      const photoResult = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "observation-photo.jpg",
        mimeType: "image/jpeg",
        fileBytes: new TextEncoder().encode("Photo bytes"),
      });

      // Link photo and voice note in observation
      const obsText = `[media:${photoResult.evidenceId}] [voice:${audioResult.evidenceId}] Seepage observed along column foundation.`;
      await queue.recordObservation(inspectionId, obsText);

      const cachedObs = await queue.getCachedObservations(inspectionId);
      expect(cachedObs).toHaveLength(1);
      expect(cachedObs[0]?.text).toContain(`[voice:${audioResult.evidenceId}]`);
      expect(cachedObs[0]?.text).toContain("Seepage observed along column foundation.");
    });
  });
});
