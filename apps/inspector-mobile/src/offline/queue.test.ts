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
});
