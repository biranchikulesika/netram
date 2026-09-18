import { describe, expect, it, vi, beforeEach } from "vitest";
import { AiAnomalyService } from "./ai-anomaly-service.js";
import type { AIAnomaly } from "@netram/types";
import type { AiAnomalyRepositoryPort } from "./ports/ai-anomaly-repository.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { AppError } from "../../../infrastructure/errors.js";
import { InvalidAiAnomalyTransitionError } from "../domain/ai-anomaly.js";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-khordha",
    user: {
      id: "user-officer-khordha",
      email: "officer.khordha@netram.gov.in",
      displayName: "District Officer Khordha",
      type: "netram",
    },
    permissions: new Set(["ai:anomaly:read", "ai:anomaly:transition"]),
    assignments: [],
    requestId: "req-ai-001",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

const mockAnomaly1: AIAnomaly = {
  id: "anomaly-1",
  inspectionId: "insp-1",
  evidenceId: "ev-1",
  type: "attendance_estimate",
  severity: "high",
  confidence: 0.88,
  modelVersion: "yolo-v8-netram-v1",
  explanation: "Expected 20 personnel, counted 6",
  status: "new",
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  projectCode: "PRJ-KHORDHA-01",
  projectName: "Khordha Hostel Construction",
  districtId: "district-khordha",
};

describe("AiAnomalyService", () => {
  let mockAuthz: AuthorizationService;
  let mockRepo: AiAnomalyRepositoryPort;
  let service: AiAnomalyService;

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["district-khordha"])),
      canAccessDistrict: vi.fn((_ctx, distId) => distId === "district-khordha"),
    } as unknown as AuthorizationService;

    mockRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "anomaly-1") return { ...mockAnomaly1 };
        return null;
      }),
      list: vi.fn().mockResolvedValue({
        items: [mockAnomaly1],
        total: 1,
      }),
      transitionWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => {
        return {
          ...mockAnomaly1,
          status: cmd.to,
          reviewedBy: cmd.reviewedBy,
          reviewedAt: cmd.reviewedAt.toISOString(),
        };
      }),
    };

    service = new AiAnomalyService(mockAuthz, mockRepo);
  });

  it("lists anomalies scoped to accessible districts and checks permission", async () => {
    const ctx = mockCtx();
    const result = await service.listAiAnomalies(ctx, { page: 1, pageSize: 10 });

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "ai:anomaly:read");
    expect(mockRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({
        jurisdictionIds: ["district-khordha"],
      }),
    );
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.id).toBe("anomaly-1");
  });

  it("gets anomaly details and verifies district access", async () => {
    const ctx = mockCtx();
    const anomaly = await service.getAiAnomaly(ctx, "anomaly-1");

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "ai:anomaly:read");
    expect(anomaly.id).toBe("anomaly-1");
  });

  it("throws 404 when anomaly not found", async () => {
    const ctx = mockCtx();
    await expect(service.getAiAnomaly(ctx, "anomaly-nonexistent")).rejects.toThrow(AppError);
  });

  it("transitions anomaly from new to reviewed with audit and outbox event", async () => {
    const ctx = mockCtx();
    const result = await service.transitionAiAnomaly(ctx, "anomaly-1", "reviewed");

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "ai:anomaly:transition", {
      districtId: "district-khordha",
    });
    expect(mockRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        anomalyId: "anomaly-1",
        to: "reviewed",
        reviewedBy: ctx.userId,
        actorUserId: ctx.userId,
        auditAction: "ai.anomaly_reviewed",
        eventType: "ai.anomaly_reviewed",
      }),
    );
    expect(result.status).toBe("reviewed");
  });

  it("transitions anomaly from new to dismissed with appropriate audit and outbox", async () => {
    const ctx = mockCtx();
    const result = await service.transitionAiAnomaly(ctx, "anomaly-1", "dismissed");

    expect(mockRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "dismissed",
        auditAction: "ai.anomaly_dismissed",
        eventType: "ai.anomaly_dismissed",
      }),
    );
    expect(result.status).toBe("dismissed");
  });

  it("rejects illegal transitions (e.g. new -> acted_upon directly)", async () => {
    const ctx = mockCtx();
    await expect(service.transitionAiAnomaly(ctx, "anomaly-1", "acted_upon")).rejects.toThrow(
      InvalidAiAnomalyTransitionError,
    );
  });
});
