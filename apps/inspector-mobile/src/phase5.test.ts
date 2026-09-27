import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemorySqliteDatabase, setTestDatabase } from "./offline/db";
import { OfflineInspectionQueue } from "./offline/queue";
import { captureEvidenceOffline, computeSha256 } from "./offline/evidence";
import type { NetramApiClient } from "@netram/api-client";
import type { Inspection } from "@netram/types";

describe("Phase 5: Camera-Only Evidence Capture & Upload Queue Specifications", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionId = "insp-p5-test-001";

  const sampleInspection: Inspection = {
    id: inspectionId,
    projectId: "proj-p5-501",
    projectCode: "PRJ-WATER-22",
    projectName: "District Rural Water Treatment Facility",
    type: "routine",
    trigger: "automatic",
    status: "in_progress",
    districtId: "dist-cuttack",
    templateId: null,
    disclosurePolicyId: null,
    disclosureRuleType: null,
    scheduledStart: "2026-09-28T09:00:00Z",
    scheduledEnd: "2026-09-28T17:00:00Z",
    startedAt: "2026-09-28T09:15:00Z",
    submittedAt: null,
    assignedUserIds: ["usr-insp-001"],
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
  };

  beforeEach(async () => {
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);
    await queue.cacheInspections([sampleInspection]);
  });

  describe("P5-01: Camera Capture Flow & SHA-256 Hashing", () => {
    it("immediately generates SHA-256 integrity hash for captured camera bytes", async () => {
      const cameraPhotoBytes = new TextEncoder().encode("JPEG-EXIF-HEADER-SITE-PHOTO-BYTES-2026");
      const expectedHash = await computeSha256(cameraPhotoBytes);

      expect(expectedHash).toMatch(/^sha256:[0-9a-f]{64}$/);

      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "pump-station-elevation.jpg",
        mimeType: "image/jpeg",
        fileBytes: cameraPhotoBytes,
        localFileUri: "file:///data/user/0/netram/cache/camera-01.jpg",
      });

      expect(result.contentHash).toBe(expectedHash);
      expect(result.evidenceId).toBeDefined();

      // Verify cached in SQLite cached_evidence
      const cached = await queue.getCachedEvidence(inspectionId);
      expect(cached).toHaveLength(1);
      expect(cached[0]?.id).toBe(result.evidenceId);
      expect(cached[0]?.content_hash).toBe(expectedHash);
      expect(cached[0]?.upload_state).toBe("pending");
      expect(cached[0]?.local_file_uri).toBe("file:///data/user/0/netram/cache/camera-01.jpg");
    });

    it("enqueues capture_evidence offline operation and registers in media_upload_queue", async () => {
      const photoBytes = new TextEncoder().encode("raw-sensor-camera-data");
      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "water-tank-crack.jpg",
        mimeType: "image/jpeg",
        fileBytes: photoBytes,
        localFileUri: "file:///data/cache/tank-crack.jpg",
      });

      // Verify operation enqueued
      const pendingOps = await queue.getPendingOperations();
      const op = pendingOps.find((o) => o.type === "capture_evidence");
      expect(op).toBeDefined();
      expect(op?.payload.evidenceId).toBe(result.evidenceId);
      expect(op?.payload.contentHash).toBe(result.contentHash);

      // Verify media upload queue item
      const dbInstance = db;
      const mediaQueue = await dbInstance.getAllAsync<{
        id: string;
        evidence_id: string;
        file_name: string;
        upload_status: string;
        content_hash: string;
      }>(`SELECT * FROM media_upload_queue WHERE evidence_id = ?`, [result.evidenceId]);

      expect(mediaQueue).toHaveLength(1);
      expect(mediaQueue[0]?.file_name).toBe("water-tank-crack.jpg");
      expect(mediaQueue[0]?.upload_status).toBe("pending");
      expect(mediaQueue[0]?.content_hash).toBe(result.contentHash);
    });
  });

  describe("P5-02: Media Upload Queue Processing during sync()", () => {
    it("successfully uploads pending media when operation is accepted and marks uploaded", async () => {
      const photoBytes = new TextEncoder().encode("pipeline-valve-photo");
      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "pipeline-valve.jpg",
        fileBytes: photoBytes,
        localFileUri: "file:///data/cache/pipeline-valve.jpg",
      });

      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: result.operation.operationId,
              inspectionId,
              type: "capture_evidence",
              status: "accepted",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
        uploadEvidence: vi.fn().mockResolvedValue({
          id: result.evidenceId,
          status: "uploaded",
        }),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);

      expect(summary.synced).toBe(1);
      expect(summary.mediaUploaded).toBe(1);
      expect(mockApiClient.uploadEvidence).toHaveBeenCalledWith(
        result.evidenceId,
        expect.anything(),
        "pipeline-valve.jpg",
      );

      // Verify media_upload_queue updated to 'uploaded'
      const dbInstance = db;
      const mediaRow = await dbInstance.getFirstAsync<{ upload_status: string }>(
        `SELECT upload_status FROM media_upload_queue WHERE evidence_id = ?`,
        [result.evidenceId],
      );
      expect(mediaRow?.upload_status).toBe("uploaded");

      // Verify cached_evidence updated to 'uploaded'
      const cached = await queue.getCachedEvidence(inspectionId);
      expect(cached[0]?.upload_state).toBe("uploaded");
    });

    it("marks upload as failed on network failure and preserves record for retry", async () => {
      const photoBytes = new TextEncoder().encode("solar-panel-array");
      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "solar-panel.jpg",
        fileBytes: photoBytes,
        localFileUri: "file:///data/cache/solar-panel.jpg",
      });

      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: result.operation.operationId,
              inspectionId,
              type: "capture_evidence",
              status: "accepted",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
        uploadEvidence: vi.fn().mockRejectedValue(new Error("503 Service Unavailable: S3 Gateway")),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);

      expect(summary.synced).toBe(1);
      expect(summary.mediaUploaded).toBe(0);

      // Failed record must be preserved in media_upload_queue
      const failedList = await queue.getFailedMediaUploads();
      expect(failedList).toHaveLength(1);
      expect(failedList[0]?.evidence_id).toBe(result.evidenceId);
      expect(failedList[0]?.error_message).toContain("503 Service Unavailable");

      // Cached evidence state reflects failed
      const cached = await queue.getCachedEvidence(inspectionId);
      expect(cached[0]?.upload_state).toBe("failed");
    });
  });

  describe("P5-03: Failed Media Retry Mechanism", () => {
    it("resets single failed media upload back to pending and clears error message", async () => {
      const photoBytes = new TextEncoder().encode("generator-room");
      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "generator.jpg",
        fileBytes: photoBytes,
        localFileUri: "file:///data/cache/generator.jpg",
      });

      // Force failure state
      const dbInstance = db;
      await dbInstance.runAsync(
        `UPDATE media_upload_queue SET upload_status = 'failed', error_message = 'Timeout' WHERE evidence_id = ?`,
        [result.evidenceId],
      );
      await dbInstance.runAsync(
        `UPDATE cached_evidence SET upload_state = 'failed' WHERE id = ?`,
        [result.evidenceId],
      );

      const failedBefore = await queue.getFailedMediaUploads();
      expect(failedBefore).toHaveLength(1);

      // Retry single item
      await queue.retryMediaUpload(failedBefore[0]!.id);

      const failedAfter = await queue.getFailedMediaUploads();
      expect(failedAfter).toHaveLength(0);

      const mediaRow = await dbInstance.getFirstAsync<{ upload_status: string; error_message: string | null }>(
        `SELECT upload_status, error_message FROM media_upload_queue WHERE evidence_id = ?`,
        [result.evidenceId],
      );
      expect(mediaRow?.upload_status).toBe("pending");
      expect(mediaRow?.error_message).toBeNull();
    });

    it("resets all failed media uploads back to pending via retryAllMediaUploads", async () => {
      const dbInstance = db;

      // Add two failed media entries
      await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "item-1.jpg",
        fileBytes: new TextEncoder().encode("1"),
      });
      await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "item-2.jpg",
        fileBytes: new TextEncoder().encode("2"),
      });

      await dbInstance.runAsync(
        `UPDATE media_upload_queue SET upload_status = 'failed', error_message = 'Connection reset'`,
      );

      const failedBefore = await queue.getFailedMediaUploads();
      expect(failedBefore).toHaveLength(2);

      await queue.retryAllMediaUploads();

      const failedAfter = await queue.getFailedMediaUploads();
      expect(failedAfter).toHaveLength(0);

      const pendingMedia = await dbInstance.getAllAsync<{ upload_status: string }>(
        `SELECT upload_status FROM media_upload_queue WHERE upload_status = 'pending'`,
      );
      expect(pendingMedia).toHaveLength(2);
    });
  });
});
