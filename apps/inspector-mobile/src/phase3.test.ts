import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemorySqliteDatabase, setTestDatabase } from "./offline/db";
import {
  OfflineInspectionQueue,
  type ChecklistItem,
  type OfflineOperationRecord,
} from "./offline/queue";
import type { NetramApiClient } from "@netram/api-client";
import type { Inspection } from "@netram/types";

describe("Phase 3 — Offline Sync Specifications", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionIdA = "insp-phase3-a-001";
  const inspectionIdB = "insp-phase3-b-002";

  beforeEach(async () => {
    vi.clearAllMocks();
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);

    const testInspections: Inspection[] = [
      {
        id: inspectionIdA,
        projectId: "proj-od-001",
        projectCode: "OD-BHR-2024-001",
        projectName: "Balasore Community Health Centre (CHC)",
        districtName: "Balasore",
        type: "routine",
        status: "assigned",
        districtId: "Balasore",
        scheduledStart: "2026-03-26T09:00:00Z",
        scheduledEnd: "2026-03-26T17:00:00Z",
        startedAt: null,
        submittedAt: null,
        assignedUserIds: ["usr-insp-001"],
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
        templateId: null,
        trigger: "officer",
        disclosurePolicyId: null,
        disclosureRuleType: null,
      },
      {
        id: inspectionIdB,
        projectId: "proj-od-002",
        projectCode: "OD-KHD-2024-002",
        projectName: "Bhubaneswar Stormwater Drain Upgradation",
        districtName: "Khordha",
        type: "surprise",
        status: "in_progress",
        districtId: "Khordha",
        scheduledStart: "2026-03-27T10:00:00Z",
        scheduledEnd: "2026-03-27T16:00:00Z",
        startedAt: "2026-03-27T10:05:00Z",
        submittedAt: null,
        assignedUserIds: ["usr-insp-001"],
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
        templateId: null,
        trigger: "officer",
        disclosurePolicyId: null,
        disclosureRuleType: null,
      },
    ];

    await queue.cacheInspections(testInspections);
  });

  // ---------------------------------------------------------------------------
  // 3.1: Sync Strategy
  // ---------------------------------------------------------------------------
  describe("3.1 Sync Strategy", () => {
    it("collects all pending operations strictly sorted by created_at ASC", async () => {
      // Enqueue multiple operations at explicit timestamps
      const op1 = await queue.recordAttendance(inspectionIdA, 12, "Muster verified");
      const op2 = await queue.startInspection(inspectionIdA);
      const op3 = await queue.recordObservation(inspectionIdA, "Found foundation works on schedule");

      // Verify pending queue returns in chronological order
      const pending = await queue.getPendingOperations();
      expect(pending).toHaveLength(3);
      expect(pending[0]?.operationId).toBe(op1.operationId);
      expect(pending[1]?.operationId).toBe(op2.operationId);
      expect(pending[2]?.operationId).toBe(op3.operationId);
      expect(pending[0]?.type).toBe("record_attendance");
      expect(pending[1]?.type).toBe("start_inspection");
      expect(pending[2]?.type).toBe("record_observation");
    });

    it("handles sync cleanly when no operations or media are pending", async () => {
      const mockApiClient = {
        syncOfflineOperations: vi.fn(),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.synced).toBe(0);
      expect(summary.conflicts).toBe(0);
      expect(summary.rejected).toBe(0);
      expect(summary.mediaUploaded).toBe(0);
      expect(mockApiClient.syncOfflineOperations).not.toHaveBeenCalled();
    });

    it("sends batch to server and updates local SQLite status for accepted operations", async () => {
      const attendanceOp = await queue.recordAttendance(inspectionIdA, 12, "Muster verified");
      const startOp = await queue.startInspection(inspectionIdA);

      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: attendanceOp.operationId,
              inspectionId: inspectionIdA,
              type: "record_attendance",
              status: "accepted",
              resultData: { recorded: true },
              syncedAt: new Date().toISOString(),
            },
            {
              operationId: startOp.operationId,
              inspectionId: inspectionIdA,
              type: "start_inspection",
              status: "accepted",
              resultData: { status: "in_progress" },
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.synced).toBe(2);
      expect(summary.conflicts).toBe(0);
      expect(summary.rejected).toBe(0);

      const remainingPending = await queue.getPendingOperations();
      expect(remainingPending).toHaveLength(0);

      const ops = await queue.getAllOperations(inspectionIdA);
      expect(ops.every((o) => o.status === "accepted")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3.2: Conflict Rules
  // ---------------------------------------------------------------------------
  describe("3.2 Conflict Rules", () => {
    it("Rule 1: Inspection already submitted by server -> Reject; inspector sees 'Submitted'", async () => {
      // Mobile enqueued an observation while offline
      const obsOp = await queue.recordObservation(inspectionIdA, "Late note recorded offline");

      // Server rejects because inspection was already closed/submitted on server authority
      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: obsOp.operationId,
              inspectionId: inspectionIdA,
              type: "record_observation",
              status: "conflict",
              code: "INSPECTION_ALREADY_SUBMITTED",
              message: "Cannot add observation to already submitted inspection.",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.conflicts).toBe(1);

      // Rule 3.2 mandate: inspector sees "Submitted"
      const cached = await queue.getCachedInspection(inspectionIdA);
      expect(cached?.status).toBe("submitted");

      // Operation recorded with conflict code and reason in SQLite
      const ops = await queue.getAllOperations(inspectionIdA);
      expect(ops[0]?.status).toBe("conflict");
      expect(ops[0]?.code).toBe("INSPECTION_ALREADY_SUBMITTED");
      expect(ops[0]?.error_message).toContain("already submitted");
    });

    it("Rule 2: Finding already deleted on server -> Reject with reason", async () => {
      // Inspector drafted a finding offline
      const findingOp = await queue.saveFindingDraft(inspectionIdB, {
        severity: "critical",
        description: "Severely corroded structural reinforcement bars",
        remediation: "Replace reinforcement cage before casting",
      });

      // Server rejects: finding or inspection component was deleted
      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: findingOp.operationId,
              inspectionId: inspectionIdB,
              type: "draft_finding",
              status: "rejected",
              code: "FINDING_DELETED_ON_SERVER",
              message: "The target component or parent finding was deleted on server.",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.rejected).toBe(1);

      // Local draft finding is marked as rejected
      const drafts = await queue.getCachedFindingDrafts(inspectionIdB);
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.sync_state).toBe("rejected");

      // Operation preserves rejection code and reason
      const opRecord = (await queue.getAllOperations(inspectionIdB)).find(
        (o) => o.operation_id === findingOp.operationId,
      );
      expect(opRecord?.status).toBe("rejected");
      expect(opRecord?.code).toBe("FINDING_DELETED_ON_SERVER");
      expect(opRecord?.error_message).toContain("deleted on server");
    });

    it("Rule 3: Evidence already uploaded (same hash) -> Accept as duplicate; no error", async () => {
      // Capture evidence offline
      const evidenceId = "ev-dup-001";
      const dupHash = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const evOp = await queue.enqueueOperation(inspectionIdA, "capture_evidence", {
        evidenceId,
        fileName: "foundation.jpg",
        contentHash: dupHash,
        evidenceType: "photo",
      });

      // Server returns DUPLICATE_EVIDENCE_HASH
      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: evOp.operationId,
              inspectionId: inspectionIdA,
              type: "capture_evidence",
              status: "conflict", // Server says duplicate hash
              code: "DUPLICATE_EVIDENCE_HASH",
              message: "File with identical SHA-256 hash already stored on server.",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
        uploadEvidence: vi.fn(),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);

      // Rule 3.2 mandate: "Accept as duplicate; no error"
      expect(summary.synced).toBe(1);
      expect(summary.conflicts).toBe(0);

      // Operation recorded as accepted without error
      const ops = await queue.getAllOperations(inspectionIdA);
      const evRecord = ops.find((o) => o.operation_id === evOp.operationId);
      expect(evRecord?.status).toBe("accepted");

      // Evidence marked as uploaded
      const evidence = await queue.getCachedEvidence(inspectionIdA);
      const item = evidence.find((e) => e.id === evidenceId);
      expect(item?.upload_state).toBe("uploaded");
    });

    it("Rule 4: Checklist item state conflict -> Server wins; mobile discards local", async () => {
      // Seed checklist item in SQLite
      const checklistItems: ChecklistItem[] = [
        {
          id: "item-p3-001",
          inspection_id: inspectionIdA,
          category: "Safety",
          question: "Are workers wearing reflective safety vests?",
          is_required: true,
          response: null,
          note: null,
          updated_at: "2026-03-26T08:00:00Z",
        },
      ];
      await queue.cacheChecklistItems(checklistItems);

      // Inspector offline marks it "fail" with note "No vests found"
      const chkOp = await queue.updateChecklistItem(
        inspectionIdA,
        "item-p3-001",
        "fail",
        "No vests found",
      );

      // Server returns conflict: server authoritative state is "pass" with note "Vests provided at 09:30"
      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: chkOp.operationId,
              inspectionId: inspectionIdA,
              type: "update_checklist_item",
              status: "conflict",
              code: "CHECKLIST_STATE_CONFLICT",
              message: "Checklist item was updated with authority override on server.",
              resultData: {
                serverStatus: "in_progress",
                response: "pass",
                note: "Vests provided at 09:30 (Server Authority)",
              },
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.conflicts).toBe(1);

      // Rule 3.2 mandate: "Server wins; mobile discards local"
      const updatedList = await queue.getCachedChecklist(inspectionIdA);
      const updatedItem = updatedList.find((i) => i.id === "item-p3-001");
      expect(updatedItem?.response).toBe("pass");
      expect(updatedItem?.note).toBe("Vests provided at 09:30 (Server Authority)");
    });
  });

  // ---------------------------------------------------------------------------
  // 3.3: Sync Screen Operations & State Management
  // ---------------------------------------------------------------------------
  describe("3.3 Sync Screen Operations & Queue Helpers", () => {
    it("groups pending operations by inspection with cached metadata", async () => {
      // Enqueue operations for inspection A and inspection B
      await queue.recordAttendance(inspectionIdA, 12, "Muster verified");
      await queue.recordObservation(inspectionIdA, "Observation A1");
      await queue.recordObservation(inspectionIdB, "Observation B1");

      const grouped = await queue.getPendingOperationsGrouped();
      expect(grouped).toHaveLength(2);

      const groupA = grouped.find((g) => g.inspectionId === inspectionIdA);
      expect(groupA).toBeDefined();
      expect(groupA?.inspection?.project_name).toBe("Balasore Community Health Centre (CHC)");
      expect(groupA?.operations).toHaveLength(2);

      const groupB = grouped.find((g) => g.inspectionId === inspectionIdB);
      expect(groupB).toBeDefined();
      expect(groupB?.inspection?.project_name).toBe("Bhubaneswar Stormwater Drain Upgradation");
      expect(groupB?.operations).toHaveLength(1);
    });

    it("retryOperation resets a failed or conflicted operation back to pending", async () => {
      const obsOp = await queue.recordObservation(inspectionIdA, "Test observation");

      // Mark as rejected via direct SQLite update (simulating server sync rejection)
      await db.runAsync(
        `UPDATE offline_operations SET status = 'rejected', code = 'NETWORK_ERROR', error_message = 'Failed to connect' WHERE operation_id = ?`,
        [obsOp.operationId],
      );

      let ops = await queue.getAllOperations(inspectionIdA);
      expect(ops[0]?.status).toBe("rejected");
      expect(ops[0]?.code).toBe("NETWORK_ERROR");

      // Inspector taps "Retry"
      await queue.retryOperation(obsOp.operationId);

      ops = await queue.getAllOperations(inspectionIdA);
      expect(ops[0]?.status).toBe("pending");
      expect(ops[0]?.code).toBeNull();
      expect(ops[0]?.error_message).toBeNull();

      // Operation is back in pending queue
      const pending = await queue.getPendingOperations();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.operationId).toBe(obsOp.operationId);
    });

    it("retryAllOperations resets all rejected and conflict operations in bulk", async () => {
      const op1 = await queue.recordAttendance(inspectionIdA, 12, "Muster verified");
      const op2 = await queue.startInspection(inspectionIdA);

      await db.runAsync(
        `UPDATE offline_operations SET status = 'rejected', error_message = 'Timeout' WHERE operation_id = ?`,
        [op1.operationId],
      );
      await db.runAsync(
        `UPDATE offline_operations SET status = 'conflict', error_message = 'Divergence' WHERE operation_id = ?`,
        [op2.operationId],
      );

      expect((await queue.getPendingOperations())).toHaveLength(0);

      // Tap "Retry All"
      const retriedCount = await queue.retryAllOperations();
      expect(retriedCount).toBe(2);

      const pending = await queue.getPendingOperations();
      expect(pending).toHaveLength(2);
    });

    it("acknowledgeOperation marks conflicted operation as dismissed without deleting audit record", async () => {
      const obsOp = await queue.recordObservation(inspectionIdA, "Conflicted note");

      await db.runAsync(
        `UPDATE offline_operations SET status = 'conflict', error_message = 'Already closed' WHERE operation_id = ?`,
        [obsOp.operationId],
      );

      // Inspector taps "Dismiss"
      await queue.acknowledgeOperation(obsOp.operationId);

      // Operation record is preserved in SQLite (§31)
      const opRecord = await db.getFirstAsync<OfflineOperationRecord>(
        `SELECT * FROM offline_operations WHERE operation_id = ?`,
        [obsOp.operationId],
      );
      expect(opRecord).toBeDefined();
      expect(opRecord?.status).toBe("conflict");

      const resultObj = JSON.parse(opRecord?.result_data || "{}");
      expect(resultObj.acknowledged).toBe(true);
      expect(resultObj.acknowledgedAt).toBeDefined();
    });
  });
});
