import { describe, expect, it, vi } from "vitest";
import type {
  Inspection,
  Observation,
  OfflineOperation,
  SyncBatchRequest,
  SyncOperationResult,
} from "@netram/types";
import type {
  InspectionRepository,
  InspectionSyncRepository,
  ObservationRepository,
  EvidenceRepository,
} from "@netram/data";
import { InspectionSyncService } from "./inspection-sync-service.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";

function makeContext(userId: string): RequestUserContext {
  return {
    userId,
    user: {
      id: userId,
      email: "test@dev.netram.in",
      displayName: "Inspector",
      type: "netram",
    },
    permissions: new Set(["inspection:transition", "observation:create", "evidence:create"]),
    assignments: [],
    requestId: "req-1",
    ipAddress: "127.0.0.1",
  };
}

function makeInspection(
  id: string,
  status: Inspection["status"],
  assignedUserIds: string[],
): Inspection {
  return {
    id,
    projectId: "proj-1",
    projectCode: "PRJ-1",
    projectName: "Project One",
    districtId: "dist-1",
    templateId: null,
    type: "routine",
    trigger: "risk_engine",
    status,
    disclosurePolicyId: null,
    disclosureRuleType: null,
    scheduledStart: "2026-03-01T06:00:00Z",
    scheduledEnd: "2026-03-01T12:00:00Z",
    startedAt: null,
    submittedAt: null,
    assignedUserIds,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  };
}

describe("InspectionSyncService", () => {
  const inspectorId = "inspector-1";
  const inspectionId = "insp-1";
  const ctx = makeContext(inspectorId);

  it("processes start_inspection and record_observation in batch", async () => {
    let currentInspection = makeInspection(inspectionId, "assigned", [inspectorId]);
    const storedResults = new Map<string, SyncOperationResult>();

    const mockAuthz = {
      canAccessDistrict: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as AuthorizationService;

    const mockInspectionRepo = {
      findById: vi.fn().mockImplementation(async () => currentInspection),
      transitionWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => {
        currentInspection = { ...currentInspection, status: cmd.to };
        return currentInspection;
      }),
    };

    const mockSyncRepo = {
      findById: vi.fn().mockImplementation(async (id) => storedResults.get(id) ?? null),
      recordResultWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => {
        const result: SyncOperationResult = {
          operationId: cmd.operationId,
          inspectionId: cmd.inspectionId,
          type: cmd.operationType,
          status: cmd.status,
          code: cmd.code,
          message: cmd.message,
          resultData: cmd.resultData,
          syncedAt: new Date().toISOString(),
        };
        storedResults.set(cmd.operationId, result);
        return result;
      }),
    };

    const mockObservationRepo = {
      createWithAuditAndEvent: vi.fn().mockResolvedValue({
        id: "obs-1",
        inspectionId,
        userId: inspectorId,
        text: "Clean kitchen observed",
        createdAt: new Date().toISOString(),
      } as Observation),
    };

    const mockEvidenceRepo = {
      captureWithAuditAndEvent: vi.fn(),
    };

    const service = new InspectionSyncService(
      mockAuthz,
      mockInspectionRepo as unknown as InspectionRepository,
      mockSyncRepo as unknown as InspectionSyncRepository,
      mockObservationRepo as unknown as ObservationRepository,
      mockEvidenceRepo as unknown as EvidenceRepository,
    );

    const batch: SyncBatchRequest = {
      operations: [
        {
          operationId: "op-1",
          inspectionId,
          type: "start_inspection",
          timestamp: "2026-03-01T06:05:00Z",
          payload: {},
        },
        {
          operationId: "op-2",
          inspectionId,
          type: "record_observation",
          timestamp: "2026-03-01T06:15:00Z",
          payload: { text: "Clean kitchen observed" },
        },
      ],
    };

    const res = await service.syncBatch(ctx, batch);
    expect(res.results).toHaveLength(2);
    expect(res.results[0]?.status).toBe("accepted");
    expect(res.results[1]?.status).toBe("accepted");
    expect(currentInspection.status).toBe("in_progress");
  });

  it("returns idempotent cached result on duplicate operation submission", async () => {
    const storedResults = new Map<string, SyncOperationResult>();
    const cachedResult: SyncOperationResult = {
      operationId: "op-already-synced",
      inspectionId,
      type: "start_inspection",
      status: "accepted",
      syncedAt: "2026-03-01T06:05:00Z",
    };
    storedResults.set("op-already-synced", cachedResult);

    const mockAuthz = {} as unknown as AuthorizationService;
    const mockInspectionRepo = { findById: vi.fn() };
    const mockSyncRepo = {
      findById: vi.fn().mockImplementation(async (id) => storedResults.get(id) ?? null),
    };

    const service = new InspectionSyncService(
      mockAuthz,
      mockInspectionRepo as unknown as InspectionRepository,
      mockSyncRepo as unknown as InspectionSyncRepository,
      {} as unknown as ObservationRepository,
      {} as unknown as EvidenceRepository,
    );

    const res = await service.syncBatch(ctx, {
      operations: [
        {
          operationId: "op-already-synced",
          inspectionId,
          type: "start_inspection",
          timestamp: "2026-03-01T06:05:00Z",
          payload: {},
        },
      ],
    });

    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toEqual(cachedResult);
    expect(mockInspectionRepo.findById).not.toHaveBeenCalled();
  });

  it("flags conflict when submitting operation against a closed inspection", async () => {
    const currentInspection = makeInspection(inspectionId, "closed", [inspectorId]);
    const mockAuthz = {
      canAccessDistrict: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as AuthorizationService;

    const mockInspectionRepo = {
      findById: vi.fn().mockResolvedValue(currentInspection),
    };

    const mockSyncRepo = {
      findById: vi.fn().mockResolvedValue(null),
      recordResultWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => ({
        operationId: cmd.operationId,
        inspectionId: cmd.inspectionId,
        type: cmd.operationType,
        status: cmd.status,
        code: cmd.code,
        message: cmd.message,
        syncedAt: new Date().toISOString(),
      })),
    };

    const service = new InspectionSyncService(
      mockAuthz,
      mockInspectionRepo as unknown as InspectionRepository,
      mockSyncRepo as unknown as InspectionSyncRepository,
      {} as unknown as ObservationRepository,
      {} as unknown as EvidenceRepository,
    );

    const op: OfflineOperation = {
      operationId: "op-conflict-1",
      inspectionId,
      type: "record_observation",
      timestamp: "2026-03-01T14:00:00Z",
      payload: { text: "Late note" },
    };

    const res = await service.syncBatch(ctx, { operations: [op] });
    expect(res.results[0]?.status).toBe("conflict");
    expect(res.results[0]?.code).toBe("INSPECTION_NOT_IN_FIELD_STAGE");
  });

  it("rejects operation when user is not assigned or authorized", async () => {
    const currentInspection = makeInspection(inspectionId, "in_progress", ["other-inspector"]);
    const mockAuthz = {
      canAccessDistrict: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(false),
    } as unknown as AuthorizationService;

    const mockInspectionRepo = {
      findById: vi.fn().mockResolvedValue(currentInspection),
    };

    const mockSyncRepo = {
      findById: vi.fn().mockResolvedValue(null),
      recordResultWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => ({
        operationId: cmd.operationId,
        inspectionId: cmd.inspectionId,
        type: cmd.operationType,
        status: cmd.status,
        code: cmd.code,
        message: cmd.message,
        syncedAt: new Date().toISOString(),
      })),
    };

    const service = new InspectionSyncService(
      mockAuthz,
      mockInspectionRepo as unknown as InspectionRepository,
      mockSyncRepo as unknown as InspectionSyncRepository,
      {} as unknown as ObservationRepository,
      {} as unknown as EvidenceRepository,
    );

    const res = await service.syncBatch(ctx, {
      operations: [
        {
          operationId: "op-unauth-1",
          inspectionId,
          type: "record_observation",
          timestamp: "2026-03-01T07:00:00Z",
          payload: { text: "Unauthorized note" },
        },
      ],
    });

    expect(res.results[0]?.status).toBe("rejected");
    expect(res.results[0]?.code).toBe("FORBIDDEN");
  });
});
