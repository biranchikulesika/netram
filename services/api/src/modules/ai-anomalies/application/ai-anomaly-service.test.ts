import { beforeEach, describe, expect, it, vi } from "vitest";
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
      type: "netram",
    },
    permissions: new Set(["ai:anomaly:read", "ai:anomaly:transition"]),
    assignments: [],
    requestId: "req-abc",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

function makeAnomaly(overrides: Partial<AIAnomaly> = {}): AIAnomaly {
  return {
    id: "anom-1",
    inspectionId: "insp-1",
    evidenceId: "evi-1",
    type: "conflict",
    severity: "high",
    confidence: 0.88,
    modelVersion: "conflict-detector-0.1",
    explanation: "Physical altercation flagged on the gate camera feed",
    status: "new",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    projectId: "proj-1",
    projectCode: "PRJ-001",
    projectName: "Vani Vihar SC/ST Hostel",
    districtId: "dist-khordha",
    ...overrides,
  };
}

describe("AiAnomalyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
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

  const fakeProjectFinder = {
    findById: vi.fn().mockResolvedValue({ projectId: "proj-1", districtId: "dist-khordha" }),
  };

  const service = new AiAnomalyService(fakeAuthz, fakeRepo, fakeProjectFinder);

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
        to: "reviewed",
        reviewedBy: ctx.userId,
        actorUserId: ctx.userId,
        auditAction: "ai.anomaly_reviewed",
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

  it("transitions an anomaly from reviewed to investigated and creates a follow-up inspection", async () => {
    const ctx = mockCtx();
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "reviewed" }));

    const updated = await service.transitionAiAnomaly(
      ctx,
      "anom-1",
      "investigated",
      "Escalated to district inspection team for on-site verification.",
    );

    expect(fakeProjectFinder.findById).toHaveBeenCalledWith("insp-1");
    expect(fakeRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "investigated",
        auditAction: "ai.anomaly_investigated",
        eventType: "ai.anomaly_investigated",
        followUpInspection: expect.objectContaining({
          projectId: "proj-1",
          leadUserId: "user-officer-1",
        }),
        auditMetadata: expect.objectContaining({
          followUpInspectionId: expect.any(String),
        }),
        eventPayload: expect.objectContaining({
          followUpInspectionId: expect.any(String),
        }),
      }),
    );
    expect(updated.status).toBe("investigated");
  });

  it("creates no follow-up inspection for non-escalation transitions", async () => {
    const ctx = mockCtx();
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "new" }));

    await service.transitionAiAnomaly(ctx, "anom-1", "reviewed");

    expect(fakeRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({ followUpInspection: undefined }),
    );
  });

  it("rejects escalation when the source inspection cannot be resolved", async () => {
    const ctx = mockCtx();
    vi.mocked(fakeRepo.findById).mockResolvedValueOnce(makeAnomaly({ status: "reviewed" }));
    vi.mocked(fakeProjectFinder.findById).mockResolvedValueOnce(null);

    await expect(service.transitionAiAnomaly(ctx, "anom-1", "investigated")).rejects.toThrow(
      AppError,
    );
    expect(fakeRepo.transitionWithAuditAndEvent).not.toHaveBeenCalled();
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
      expect.objectContaining({
        to: "dismissed",
        auditAction: "ai.anomaly_dismissed",
        eventType: "ai.anomaly_dismissed",
      }),
    );
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
      InvalidAiAnomalyTransitionError,
    );
  });
});
