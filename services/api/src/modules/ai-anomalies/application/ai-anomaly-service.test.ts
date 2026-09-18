<<<<<<< HEAD
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
=======
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../infrastructure/errors.js";
import { AiAnomalyService } from "./ai-anomaly-service.js";
import { InvalidAiAnomalyTransitionError } from "../domain/ai-anomaly.js";
import type { AIAnomaly } from "@netram/types";
import type { AiAnomalyRepositoryPort } from "./ports/ai-anomaly-repository.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-1",
    user: {
      id: "user-officer-1",
      email: "officer@netram.gov.in",
      displayName: "District Officer",
>>>>>>> origin/production
      type: "netram",
    },
    permissions: new Set(["ai:anomaly:read", "ai:anomaly:transition"]),
    assignments: [],
<<<<<<< HEAD
    requestId: "req-ai-001",
=======
    requestId: "req-abc",
>>>>>>> origin/production
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

<<<<<<< HEAD
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
=======
function makeAnomaly(overrides: Partial<AIAnomaly> = {}): AIAnomaly {
  return {
    id: "anom-1",
    inspectionId: "insp-1",
    evidenceId: "evi-1",
    type: "attendance_estimate",
    severity: "high",
    confidence: 0.88,
    modelVersion: "yolo-v8-dev",
    explanation: "Headcount divergence detected",
    status: "new",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    projectCode: "PRJ-001",
    projectName: "Vani Vihar SC/ST Hostel",
    districtId: "dist-khordha",
    ...overrides,
  };
}

describe("AiAnomalyService", () => {
  const fakeAuthz = {
    requirePermission: vi.fn(),
    accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["dist-khordha"])),
    canAccessDistrict: vi.fn().mockReturnValue(true),
  } as unknown as AuthorizationService;

  const fakeRepo: AiAnomalyRepositoryPort = {
    list: vi.fn().mockResolvedValue({ items: [makeAnomaly()], total: 1 }),
    findById: vi.fn().mockResolvedValue(makeAnomaly()),
    transitionWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) =>
      makeAnomaly({
        status: cmd.to,
        reviewedBy: cmd.reviewedBy,
        reviewedAt: cmd.reviewedAt.toISOString(),
      }),
    ),
  };

  const service = new AiAnomalyService(fakeAuthz, fakeRepo);

  it("lists AI anomalies with district jurisdiction scoping", async () => {
    const ctx = mockCtx();
    const res = await service.listAiAnomalies(ctx, { page: 1, pageSize: 10 });
    expect(fakeAuthz.requirePermission).toHaveBeenCalledWith(ctx, "ai:anomaly:read");
    expect(fakeRepo.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      type: undefined,
      severity: undefined,
      status: undefined,
      inspectionId: undefined,
      jurisdictionIds: ["dist-khordha"],
    });
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it("retrieves an AI anomaly within accessible jurisdiction", async () => {
    const ctx = mockCtx();
    const anomaly = await service.getAiAnomaly(ctx, "anom-1");
    expect(fakeAuthz.requirePermission).toHaveBeenCalledWith(ctx, "ai:anomaly:read");
    expect(fakeAuthz.canAccessDistrict).toHaveBeenCalledWith(ctx, "dist-khordha");
    expect(anomaly.id).toBe("anom-1");
  });

  it("throws not found when retrieving anomaly outside accessible district", async () => {
    const ctx = mockCtx();
    vi.mocked(fakeAuthz.canAccessDistrict).mockReturnValueOnce(false);
    await expect(service.getAiAnomaly(ctx, "anom-1")).rejects.toThrow(AppError);
  });

  it("transitions an anomaly from new to reviewed with audit and outbox event", async () => {
    const ctx = mockCtx();
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "new" }));

    const updated = await service.transitionAiAnomaly(
      ctx,
      "anom-1",
      "reviewed",
      "Headcount discrepancy verified by authority.",
    );

    expect(fakeAuthz.requirePermission).toHaveBeenCalledWith(ctx, "ai:anomaly:transition", {
      districtId: "dist-khordha",
    });
    expect(fakeRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        anomalyId: "anom-1",
>>>>>>> origin/production
        to: "reviewed",
        reviewedBy: ctx.userId,
        actorUserId: ctx.userId,
        auditAction: "ai.anomaly_reviewed",
<<<<<<< HEAD
        eventType: "ai.anomaly_reviewed",
      }),
    );
    expect(result.status).toBe("reviewed");
  });

  it("transitions anomaly from new to dismissed with appropriate audit and outbox", async () => {
    const ctx = mockCtx();
    const result = await service.transitionAiAnomaly(ctx, "anomaly-1", "dismissed");

    expect(mockRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
=======
        auditMetadata: {
          from: "new",
          to: "reviewed",
          note: "Headcount discrepancy verified by authority.",
        },
        eventType: "ai.anomaly_reviewed",
        eventPayload: expect.objectContaining({
          anomalyId: "anom-1",
          from: "new",
          to: "reviewed",
          note: "Headcount discrepancy verified by authority.",
        }),
      }),
    );
    expect(updated.status).toBe("reviewed");
  });

  it("transitions an anomaly from reviewed to investigated", async () => {
    const ctx = mockCtx();
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "reviewed" }));

    const updated = await service.transitionAiAnomaly(
      ctx,
      "anom-1",
      "investigated",
      "Escalated to district inspection team for on-site verification.",
    );

    expect(fakeRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "investigated",
        auditAction: "ai.anomaly_investigated",
        eventType: "ai.anomaly_investigated",
      }),
    );
    expect(updated.status).toBe("investigated");
  });

  it("transitions an anomaly to dismissed with dismissed audit and event", async () => {
    const ctx = mockCtx();
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "new" }));

    const updated = await service.transitionAiAnomaly(
      ctx,
      "anom-1",
      "dismissed",
      "Known false alarm due to camera angle distortion.",
    );

    expect(fakeRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
>>>>>>> origin/production
      expect.objectContaining({
        to: "dismissed",
        auditAction: "ai.anomaly_dismissed",
        eventType: "ai.anomaly_dismissed",
      }),
    );
<<<<<<< HEAD
    expect(result.status).toBe("dismissed");
  });

  it("rejects illegal transitions (e.g. new -> acted_upon directly)", async () => {
    const ctx = mockCtx();
    await expect(service.transitionAiAnomaly(ctx, "anomaly-1", "acted_upon")).rejects.toThrow(
=======
    expect(updated.status).toBe("dismissed");
  });

  it("rejects invalid state machine transitions according to domain rules", async () => {
    const ctx = mockCtx();
    // Cannot jump straight from new to acted_upon (AI is advisory, requires review first)
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "new" }));
    await expect(service.transitionAiAnomaly(ctx, "anom-1", "acted_upon")).rejects.toThrow(
      InvalidAiAnomalyTransitionError,
    );

    // Terminal state cannot transition further
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "dismissed" }));
    await expect(service.transitionAiAnomaly(ctx, "anom-1", "reviewed")).rejects.toThrow(
>>>>>>> origin/production
      InvalidAiAnomalyTransitionError,
    );
  });
});
