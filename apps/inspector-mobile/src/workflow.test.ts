import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import { InMemorySqliteDatabase, setTestDatabase } from "./offline/db";
import { OfflineInspectionQueue } from "./offline/queue";
import { captureEvidenceOffline, computeSha256 } from "./offline/evidence";
import {
  clearSession,
  getStoredSession,
  saveSession,
  type InspectorSession,
} from "./auth/session";
import type { NetramApiClient } from "@netram/api-client";
import type { Inspection } from "@netram/types";

// In-memory mock for SecureStore
const mockSecureStore = new Map<string, string>();

vi.mock("expo-secure-store", () => {
  return {
    getItemAsync: vi.fn(async (key: string) => mockSecureStore.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      mockSecureStore.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      mockSecureStore.delete(key);
    }),
  };
});

describe("Phase 15: End-to-End Workflow Verification", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionId = "insp-p15-verify-001";

  beforeEach(() => {
    mockSecureStore.clear();
    vi.clearAllMocks();
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);
  });

  describe("P15-01: Full Auth Lifecycle", () => {
    it("manages login, persistent restoration across restarts, and clean sign-out", async () => {
      const activeSession: InspectorSession = {
        token: "jwt-inspector-token-2026",
        user: {
          id: "usr-insp-001",
          email: "inspector.one@dev.netram.in",
          displayName: "Inspector One",
          type: "inspector",
        },
        apiUrl: "http://localhost:3001",
      };

      // 1. Initial State: No session
      expect(await getStoredSession()).toBeNull();

      // 2. Login: Token & user saved to SecureStore
      await saveSession(activeSession);
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);

      // 3. App Restart Simulation: Retrieve session from persistent store
      const restoredSession = await getStoredSession();
      expect(restoredSession).not.toBeNull();
      expect(restoredSession?.token).toBe("jwt-inspector-token-2026");
      expect(restoredSession?.user.email).toBe("inspector.one@dev.netram.in");

      // 4. Logout: SecureStore cleared
      await clearSession();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
      expect(await getStoredSession()).toBeNull();
    });
  });

  describe("P15-02: Online Inspection Workflow", () => {
    it("fetches, caches, starts, observes, findings, and submits inspection", async () => {
      const serverInspection: Inspection = {
        id: inspectionId,
        projectId: "proj-101",
        projectCode: "PRJ-SANITATION",
        projectName: "Khordha Water & Sanitation Facility",
        type: "routine",
        status: "assigned",
        districtId: "dist-khordha",
        scheduledStart: "2026-03-20T08:00:00Z",
        scheduledEnd: "2026-03-20T16:00:00Z",
        startedAt: null,
        submittedAt: null,
        assignedUserIds: ["usr-insp-001"],
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
        templateId: null,
        trigger: "officer",
        disclosurePolicyId: null,
        disclosureRuleType: null,
      };

      // 1. Fetch from server & cache in SQLite
      await queue.cacheInspections([serverInspection]);
      const cached = await queue.getCachedInspection(inspectionId);
      expect(cached).toBeDefined();
      expect(cached?.status).toBe("assigned");
      expect(cached?.project_code).toBe("PRJ-SANITATION");

      // 2. Start inspection
      await queue.startInspection(inspectionId);
      const afterStart = await queue.getCachedInspection(inspectionId);
      expect(afterStart?.status).toBe("in_progress");
      expect(afterStart?.started_at).toBeDefined();

      // 3. Add observation
      await queue.recordObservation(inspectionId, "Perimeter security fence intact and locked.");
      const obs = await queue.getCachedObservations(inspectionId);
      expect(obs).toHaveLength(1);
      expect(obs[0]?.text).toBe("Perimeter security fence intact and locked.");

      // 4. Draft finding
      await queue.saveFindingDraft(inspectionId, {
        severity: "medium",
        description: "Emergency signage missing in chemical storage bay.",
        remediation: "Install high-visibility reflective signs.",
      });
      const drafts = await queue.getCachedFindingDrafts(inspectionId);
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.severity).toBe("medium");

      // 5. Submit inspection
      await queue.submitInspection(inspectionId);
      const afterSubmit = await queue.getCachedInspection(inspectionId);
      expect(afterSubmit?.status).toBe("submitted");
      expect(afterSubmit?.submitted_at).toBeDefined();

      // 6. Verify operations queue contains all sequence items
      const ops = await queue.getAllOperations(inspectionId);
      expect(ops).toHaveLength(4);
      expect(ops.map((o) => o.operation_type)).toEqual([
        "start_inspection",
        "record_observation",
        "draft_finding",
        "submit_inspection",
      ]);
    });
  });

  describe("P15-03: Offline Inspection Workflow & Resumption", () => {
    it("handles full offline operation queueing and reconciles upon reconnect", async () => {
      // 1. Seed assigned inspection offline
      await queue.cacheInspections([
        {
          id: inspectionId,
          projectId: "proj-offline",
          projectCode: "PRJ-OFF",
          projectName: "Remote Forest Outpost",
          type: "routine",
          status: "assigned",
          districtId: "dist-forest",
          scheduledStart: "2026-03-21T07:00:00Z",
          scheduledEnd: "2026-03-21T15:00:00Z",
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
      ]);

      // 2. Offline actions: start, observe, draft finding
      const op1 = await queue.startInspection(inspectionId);
      const op2 = await queue.recordObservation(inspectionId, "Zero cellular connectivity at site.");
      const op3 = await queue.saveFindingDraft(inspectionId, {
        severity: "low",
        description: "Minor paint peeling on exterior wall.",
      });

      // Assert optimistic updates
      const inspectionState = await queue.getCachedInspection(inspectionId);
      expect(inspectionState?.status).toBe("in_progress");
      const pendingOps = await queue.getPendingOperations();
      expect(pendingOps).toHaveLength(3);

      // 3. Network re-established: Trigger sync
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
            {
              operationId: op3.operationId,
              inspectionId,
              type: "draft_finding",
              status: "accepted",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
        uploadEvidence: vi.fn(),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.synced).toBe(3);
      expect(summary.conflicts).toBe(0);
      expect(summary.rejected).toBe(0);

      // 4. Assert local queue is fully reconciled
      const pendingAfterSync = await queue.getPendingOperations();
      expect(pendingAfterSync).toHaveLength(0);
    });
  });

  describe("P15-04: Evidence Capture & Verification", () => {
    it("computes SHA-256 digest at capture time and uploads on sync", async () => {
      const photoBytes = new TextEncoder().encode("VERIFIED-FOUNDATION-SITE-EVIDENCE-2026");
      const expectedDigest = await computeSha256(photoBytes);

      const captureResult = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "foundation-block-1.jpg",
        fileBytes: photoBytes,
        latitude: 20.2961,
        longitude: 85.8245,
      });

      expect(captureResult.contentHash).toBe(expectedDigest);
      expect(captureResult.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);

      // Check SQLite record
      const evidenceList = await queue.getCachedEvidence(inspectionId);
      expect(evidenceList).toHaveLength(1);
      expect(evidenceList[0]?.content_hash).toBe(expectedDigest);
      expect(evidenceList[0]?.upload_state).toBe("pending");

      // Sync and verify upload
      const uploadMock = vi.fn().mockResolvedValue({
        id: captureResult.evidenceId,
        inspectionId,
        contentHash: expectedDigest,
        uploadState: "uploaded",
        integrityState: "verified",
      });

      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: captureResult.operation.operationId,
              inspectionId,
              type: "capture_evidence",
              status: "accepted",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
        uploadEvidence: uploadMock,
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.synced).toBe(1);
      expect(summary.mediaUploaded).toBe(1);
      expect(uploadMock).toHaveBeenCalledTimes(1);

      // Verify evidence state transitioned to uploaded
      const updatedEvidence = await queue.getCachedEvidence(inspectionId);
      expect(updatedEvidence[0]?.upload_state).toBe("uploaded");
    });
  });

  describe("P15-05: Sync Conflict Handling", () => {
    it("surfaces server conflict in queue and supports dismissal without deleting audit trace", async () => {
      const op = await queue.submitInspection(inspectionId);

      const mockApiClient = {
        syncOfflineOperations: vi.fn().mockResolvedValue({
          results: [
            {
              operationId: op.operationId,
              inspectionId,
              type: "submit_inspection",
              status: "conflict",
              code: "INSPECTION_NOT_IN_FIELD_STAGE",
              message: "Cannot submit: Inspection has already been closed by the district authority.",
              syncedAt: new Date().toISOString(),
            },
          ],
          processedAt: new Date().toISOString(),
        }),
      } as unknown as NetramApiClient;

      const summary = await queue.sync(mockApiClient);
      expect(summary.conflicts).toBe(1);

      // Confirm conflict recorded in operations
      const allOps = await queue.getAllOperations(inspectionId);
      const conflictOp = allOps.find((o) => o.operation_id === op.operationId);
      expect(conflictOp?.status).toBe("conflict");
      expect(conflictOp?.code).toBe("INSPECTION_NOT_IN_FIELD_STAGE");
      expect(conflictOp?.error_message).toContain("already been closed");

      // Dismiss / Acknowledge conflict in Sync Center
      await queue.acknowledgeOperation(op.operationId);
      const allOpsAfterDismiss = await queue.getAllOperations(inspectionId);
      const dismissedOp = allOpsAfterDismiss.find((o) => o.operation_id === op.operationId);
      expect(dismissedOp).toBeDefined(); // Preserved for statutory audit trail (§37)
      const parsedData = JSON.parse(dismissedOp?.result_data || "{}");
      expect(parsedData.acknowledged).toBe(true);
      expect(parsedData.acknowledgedAt).toBeDefined();
    });
  });
});
