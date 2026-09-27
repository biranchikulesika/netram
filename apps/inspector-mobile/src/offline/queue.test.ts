import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemorySqliteDatabase, setTestDatabase } from "./db";
import { OfflineInspectionQueue } from "./queue";
import { captureEvidenceOffline, computeSha256 } from "./evidence";
import type { NetramApiClient } from "@netram/api-client";

describe("OfflineInspectionQueue", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionId = "insp-test-123";

  beforeEach(async () => {
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);
  });

  it("enqueues operations and returns pending queue in order", async () => {
    await queue.enqueueOperation(inspectionId, "start_inspection", { note: "Arrived" });
    await queue.enqueueOperation(inspectionId, "record_observation", { text: "Obs 1" });

    const pending = await queue.getPendingOperations();
    expect(pending).toHaveLength(2);
    expect(pending[0]?.type).toBe("start_inspection");
    expect(pending[1]?.type).toBe("record_observation");
    expect(pending[0]?.operationId).toBeDefined();
  });

  it("computes SHA-256 hash formatted as sha256:hex", async () => {
    const data = new TextEncoder().encode("Hello Netram Evidence");
    const hash = await computeSha256(data);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("captures evidence offline with metadata and enqueues operation", async () => {
    const fileBytes = new TextEncoder().encode("Test Photo Bytes");
    const res = await captureEvidenceOffline(queue, {
      inspectionId,
      evidenceType: "photo",
      fileName: "site-photo.jpg",
      fileBytes,
      latitude: 20.2961,
      longitude: 85.8245,
    });

    expect(res.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(res.evidenceId).toBeDefined();
    expect(res.operation.type).toBe("capture_evidence");

    const pending = await queue.getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.payload.contentHash).toBe(res.contentHash);
  });

  it("synchronizes pending operations against API client and reconciles outcomes", async () => {
    const op1 = await queue.enqueueOperation(inspectionId, "start_inspection");
    const op2 = await queue.enqueueOperation(inspectionId, "record_observation", { text: "Obs 2" });

    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: op1.operationId,
            inspectionId,
            type: "start_inspection",
            status: "accepted",
            syncedAt: new Date().toISOString(),
          },
          {
            operationId: op2.operationId,
            inspectionId,
            type: "record_observation",
            status: "accepted",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
      uploadEvidence: vi.fn().mockResolvedValue({ status: "uploaded" }),
    } as unknown as NetramApiClient;

    const summary = await queue.sync(mockApiClient);
    expect(summary.synced).toBe(2);
    expect(summary.conflicts).toBe(0);
    expect(summary.rejected).toBe(0);
    expect(mockApiClient.syncOfflineOperations).toHaveBeenCalledOnce();
  });

  it("handles conflict outcome gracefully and preserves error details", async () => {
    const op1 = await queue.enqueueOperation(inspectionId, "record_observation", {
      text: "Late note",
    });

    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: op1.operationId,
            inspectionId,
            type: "record_observation",
            status: "conflict",
            code: "INSPECTION_NOT_IN_FIELD_STAGE",
            message: "Inspection is closed.",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
    } as unknown as NetramApiClient;

    const summary = await queue.sync(mockApiClient);
    expect(summary.synced).toBe(0);
    expect(summary.conflicts).toBe(1);
    expect(summary.results[0]?.code).toBe("INSPECTION_NOT_IN_FIELD_STAGE");
  });

  it("retrieves cached observations recorded offline in SQLite", async () => {
    await queue.enqueueOperation(inspectionId, "record_observation", {
      text: "Hostel kitchen inspected - clean utensils",
    });
    await queue.enqueueOperation(inspectionId, "record_observation", {
      text: "Emergency exit clear and unlocked",
    });

    const obs = await queue.getCachedObservations(inspectionId);
    expect(obs).toHaveLength(2);
    expect(obs[0]?.text).toBe("Hostel kitchen inspected - clean utensils");
    expect(obs[1]?.text).toBe("Emergency exit clear and unlocked");
    expect(obs[0]?.is_local).toBe(1);
  });

  it("saves and edits one pending finding draft without duplicating its operation", async () => {
    const draft = await queue.saveFindingDraft(inspectionId, {
      severity: "high",
      description: "Emergency exit is obstructed.",
      remediation: "Clear the exit immediately.",
    });
    const findingId = String(draft.payload.findingId);
    await queue.saveFindingDraft(inspectionId, {
      findingId,
      operationId: draft.operationId,
      severity: "critical",
      description: "Emergency exit remains obstructed.",
    });

    const pending = await queue.getPendingOperations();
    const drafts = await queue.getCachedFindingDrafts(inspectionId);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("draft_finding");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.severity).toBe("critical");
    expect(drafts[0]?.description).toBe("Emergency exit remains obstructed.");
  });

  it("requeues a conflicted finding draft with the same draft ID", async () => {
    const draft = await queue.saveFindingDraft(inspectionId, { severity: "high", description: "Blocked exit" });
    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({ results: [{ operationId: draft.operationId, inspectionId, type: "draft_finding", status: "conflict", code: "INSPECTION_NOT_IN_FIELD_STAGE", message: "Inspection closed", syncedAt: new Date().toISOString() }], processedAt: new Date().toISOString() }),
    } as unknown as NetramApiClient;
    await queue.sync(mockApiClient);
    await queue.saveFindingDraft(inspectionId, { findingId: String(draft.payload.findingId), operationId: draft.operationId, severity: "high", description: "Corrected description" });

    const pending = await queue.getPendingOperations();
    const drafts = await queue.getCachedFindingDrafts(inspectionId);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.operationId).not.toBe(draft.operationId);
    expect(drafts[0]?.sync_state).toBe("pending");
  });

  it("retrieves cached evidence records with capture-time hashes in SQLite", async () => {
    const fileBytes = new TextEncoder().encode("Hostel Dining Hall Photo Bytes");
    const evResult = await captureEvidenceOffline(queue, {
      inspectionId,
      evidenceType: "photo",
      fileName: "dining-hall.jpg",
      fileBytes,
      latitude: 20.2961,
      longitude: 85.8245,
    });

    const evRecords = await queue.getCachedEvidence(inspectionId);
    expect(evRecords).toHaveLength(1);
    expect(evRecords[0]?.id).toBe(evResult.evidenceId);
    expect(evRecords[0]?.content_hash).toBe(evResult.contentHash);
    expect(evRecords[0]?.upload_state).toBe("pending");
    expect(evRecords[0]?.integrity_state).toBe("pending_verification");
  });

  it("uploads media file when evidence capture operation is accepted during sync", async () => {
    const fileBytes = new TextEncoder().encode("Classroom Construction Proof");
    const evResult = await captureEvidenceOffline(queue, {
      inspectionId,
      evidenceType: "photo",
      fileName: "classroom-progress.jpg",
      fileBytes,
    });

    const uploadEvidenceMock = vi.fn().mockResolvedValue({
      id: evResult.evidenceId,
      inspectionId,
      contentHash: evResult.contentHash,
      evidenceType: "photo",
    });

    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: evResult.operation.operationId,
            inspectionId,
            type: "capture_evidence",
            status: "accepted",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
      uploadEvidence: uploadEvidenceMock,
    } as unknown as NetramApiClient;

    const summary = await queue.sync(mockApiClient);

    expect(summary.synced).toBe(1);
    expect(summary.mediaUploaded).toBe(1);
    expect(uploadEvidenceMock).toHaveBeenCalledWith(
      evResult.evidenceId,
      expect.any(Blob),
      "classroom-progress.jpg",
    );

    const evRecords = await queue.getCachedEvidence(inspectionId);
    expect(evRecords[0]?.upload_state).toBe("uploaded");

    const failedMedia = await queue.getFailedMediaUploads();
    expect(failedMedia).toHaveLength(0);
  });

  it("handles media upload failure and supports retry mechanisms", async () => {
    const fileBytes = new TextEncoder().encode("Drainage Inspection Photo");
    const evResult = await captureEvidenceOffline(queue, {
      inspectionId,
      evidenceType: "photo",
      fileName: "drainage-trench.jpg",
      fileBytes,
    });

    const failingApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: evResult.operation.operationId,
            inspectionId,
            type: "capture_evidence",
            status: "accepted",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
      uploadEvidence: vi.fn().mockRejectedValue(new Error("Network timeout: gateway down")),
    } as unknown as NetramApiClient;

    const summary = await queue.sync(failingApiClient);
    expect(summary.synced).toBe(1);
    expect(summary.mediaUploaded).toBe(0);

    const failedMedia = await queue.getFailedMediaUploads();
    expect(failedMedia).toHaveLength(1);
    expect(failedMedia[0]?.file_name).toBe("drainage-trench.jpg");
    expect(failedMedia[0]?.error_message).toBe("Network timeout: gateway down");

    const evRecords = await queue.getCachedEvidence(inspectionId);
    expect(evRecords[0]?.upload_state).toBe("failed");

    // Test single retry
    await queue.retryMediaUpload(failedMedia[0]!.id);
    const failedAfterRetry = await queue.getFailedMediaUploads();
    expect(failedAfterRetry).toHaveLength(0);

    const evAfterRetry = await queue.getCachedEvidence(inspectionId);
    expect(evAfterRetry[0]?.upload_state).toBe("pending");

    // Re-fail it via sync to test bulk retry
    await queue.sync(failingApiClient);
    const failedAgain = await queue.getFailedMediaUploads();
    expect(failedAgain).toHaveLength(1);

    // Test bulk retry
    await queue.retryAllMediaUploads();
    const failedAfterBulkRetry = await queue.getFailedMediaUploads();
    expect(failedAfterBulkRetry).toHaveLength(0);

    const evAfterBulk = await queue.getCachedEvidence(inspectionId);
    expect(evAfterBulk[0]?.upload_state).toBe("pending");
  });

  it("acknowledges and dismisses a conflict or rejected operation without deleting its audit record", async () => {
    const op = await queue.enqueueOperation(inspectionId, "submit_inspection");

    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: op.operationId,
            inspectionId,
            type: "submit_inspection",
            status: "conflict",
            code: "INSPECTION_ALREADY_SUBMITTED",
            message: "Inspection already submitted by another team member",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
    } as unknown as NetramApiClient;

    await queue.sync(mockApiClient);

    const allOpsBefore = await queue.getAllOperations(inspectionId);
    expect(allOpsBefore).toHaveLength(1);
    expect(allOpsBefore[0]?.status).toBe("conflict");

    // Acknowledge operation
    await queue.acknowledgeOperation(op.operationId);

    const allOpsAfter = await queue.getAllOperations(inspectionId);
    expect(allOpsAfter).toHaveLength(1); // Record preserved for audit
    const parsedResult = JSON.parse(allOpsAfter[0]?.result_data || "{}");
    expect(parsedResult.acknowledged).toBe(true);
    expect(parsedResult.acknowledgedAt).toBeDefined();
  });

  it("enqueues and synchronizes check_in field arrival operation", async () => {
    const op = await queue.checkIn(inspectionId, 28.6139, 77.209, 12.5);

    expect(op.type).toBe("check_in");
    expect(op.inspectionId).toBe(inspectionId);
    expect(op.payload.latitude).toBe(28.6139);
    expect(op.payload.longitude).toBe(77.209);
    expect(op.payload.accuracy).toBe(12.5);
    expect(op.payload.clientTimestamp).toBeDefined();

    const pending = await queue.getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("check_in");

    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: op.operationId,
            inspectionId,
            type: "check_in",
            status: "accepted",
            message: "Field check-in recorded. Server validates jurisdiction against project geofence boundary.",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
      uploadEvidence: vi.fn(),
    } as unknown as NetramApiClient;

    const summary = await queue.sync(mockApiClient);
    expect(summary.synced).toBe(1);

    const pendingAfter = await queue.getPendingOperations();
    expect(pendingAfter).toHaveLength(0);

    const allOps = await queue.getAllOperations(inspectionId);
    expect(allOps[0]?.status).toBe("accepted");
  });

  it("clears cached inspections while strictly preserving pending operations", async () => {
    // 1. Cache inspection
    await queue.cacheInspections([
      {
        id: "insp-clear-test",
        projectId: "proj-1",
        projectCode: "PRJ-01",
        projectName: "Test Project",
        type: "routine",
        status: "assigned",
        districtId: "dist-1",
        scheduledStart: "2026-03-01T06:00:00Z",
        scheduledEnd: "2026-03-01T12:00:00Z",
        startedAt: null,
        submittedAt: null,
        assignedUserIds: [],
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
        templateId: null,
        trigger: "officer",
        disclosurePolicyId: null,
        disclosureRuleType: null,
      },
    ]);

    const cachedBefore = await queue.getCachedInspections();
    expect(cachedBefore).toHaveLength(1);

    // 2. Enqueue pending operation
    await queue.enqueueOperation("insp-clear-test", "record_observation", { text: "Keep this" });
    const pendingBefore = await queue.getPendingOperations();
    expect(pendingBefore).toHaveLength(1);

    // 3. Clear cache
    await queue.clearCachedInspections();

    // 4. Verify cached inspections are gone but pending operations remain intact
    const cachedAfter = await queue.getCachedInspections();
    expect(cachedAfter).toHaveLength(0);

    const pendingAfter = await queue.getPendingOperations();
    expect(pendingAfter).toHaveLength(1);
    expect(pendingAfter[0]?.payload.text).toBe("Keep this");
  });

  it("enqueues and synchronizes record_attendance offline operation", async () => {
    const op = await queue.recordAttendance(inspectionId, 35, "Morning site check");
    expect(op.type).toBe("record_attendance");
    expect(op.inspectionId).toBe(inspectionId);
    expect(op.payload.workerCount).toBe(35);
    expect(op.payload.note).toBe("Morning site check");

    const pending = await queue.getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("record_attendance");

    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: op.operationId,
            inspectionId,
            type: "record_attendance",
            status: "accepted",
            message: "Attendance headcount record verified and saved.",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
      uploadEvidence: vi.fn(),
    } as unknown as NetramApiClient;

    const summary = await queue.sync(mockApiClient);
    expect(summary.synced).toBe(1);

    const pendingAfter = await queue.getPendingOperations();
    expect(pendingAfter).toHaveLength(0);
  });

  it("applies optimistic local state updates when starting and submitting inspections", async () => {
    // Seed cached inspection in assigned state
    await queue.cacheInspections([
      {
        id: inspectionId,
        projectId: "proj-optimistic",
        projectCode: "PRJ-OPT",
        projectName: "Optimistic Update Project",
        type: "routine",
        status: "assigned",
        districtId: "dist-1",
        scheduledStart: "2026-03-01T08:00:00Z",
        scheduledEnd: "2026-03-01T16:00:00Z",
        startedAt: null,
        submittedAt: null,
        assignedUserIds: [],
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
        templateId: null,
        trigger: "officer",
        disclosurePolicyId: null,
        disclosureRuleType: null,
      },
    ]);

    const initial = await queue.getCachedInspection(inspectionId);
    expect(initial?.status).toBe("assigned");
    expect(initial?.started_at).toBeNull();

    // 1. Start inspection -> optimistic in_progress
    await queue.startInspection(inspectionId);
    const afterStart = await queue.getCachedInspection(inspectionId);
    expect(afterStart?.status).toBe("in_progress");
    expect(afterStart?.started_at).toBeDefined();

    // 2. Submit inspection -> optimistic submitted
    await queue.submitInspection(inspectionId);
    const afterSubmit = await queue.getCachedInspection(inspectionId);
    expect(afterSubmit?.status).toBe("submitted");
    expect(afterSubmit?.submitted_at).toBeDefined();
  });

  it("handles rejected sync outcome properly and updates operation error details", async () => {
    const op = await queue.recordAttendance(inspectionId, 999999, "Unreasonable headcount");

    const mockApiClient = {
      syncOfflineOperations: vi.fn().mockResolvedValue({
        results: [
          {
            operationId: op.operationId,
            inspectionId,
            type: "record_attendance",
            status: "rejected",
            code: "HEADCOUNT_EXCEEDS_LIMIT",
            message: "Headcount exceeds maximum plausible site workers (5000)",
            syncedAt: new Date().toISOString(),
          },
        ],
        processedAt: new Date().toISOString(),
      }),
      uploadEvidence: vi.fn(),
    } as unknown as NetramApiClient;

    const summary = await queue.sync(mockApiClient);
    expect(summary.synced).toBe(0);
    expect(summary.rejected).toBe(1);
    expect(summary.conflicts).toBe(0);

    const allOps = await queue.getAllOperations(inspectionId);
    const rejectedOp = allOps.find((o) => o.operation_id === op.operationId);
    expect(rejectedOp?.status).toBe("rejected");
    expect(rejectedOp?.code).toBe("HEADCOUNT_EXCEEDS_LIMIT");
    expect(rejectedOp?.error_message).toBe("Headcount exceeds maximum plausible site workers (5000)");
  });
});
