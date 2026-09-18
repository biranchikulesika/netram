import { describe, expect, it, vi } from "vitest";
import { AnalyticsService } from "./analytics-service.js";
import { AppError } from "../../../infrastructure/errors.js";
import type { AnalyticsRepositoryPort } from "./ports/analytics-repository.port.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorityAnalyticsOverview } from "@netram/types";

const mockOverview: AuthorityAnalyticsOverview = {
  summary: {
    totalProjects: 10,
    activeProjects: 8,
    totalInspections: 15,
    closedInspections: 12,
    averageClosureDays: 3.5,
    totalCorrectiveActions: 6,
    resolvedCorrectiveActions: 4,
    overdueCorrectiveActions: 1,
    overallSlaComplianceRate: 83.3,
    totalComplaints: 5,
    resolvedComplaints: 4,
    complaintRedressalRate: 80,
    totalFindings: 14,
    criticalFindingsCount: 2,
  },
  slaComplianceByJurisdiction: [],
  deficiencyRecurrence: [],
  inspectionClosureVelocity: {
    totalInspections: 15,
    closedInspections: 12,
    inProgressInspections: 2,
    underReviewInspections: 1,
    averageClosureDays: 3.5,
    velocityByJurisdiction: [],
  },
  generatedAt: new Date().toISOString(),
};

function mockAuthz(perms: string[] = ["report:read"]): AuthorizationService {
  const permSet = new Set(perms);
  return {
    hasPermission: vi.fn((_ctx, p) => permSet.has(p)),
    canAccessDistrict: vi.fn((_ctx, distId) => distId === "district-allowed"),
    accessibleDistrictIds: vi.fn(() => new Set(["district-allowed"])),
  } as unknown as AuthorizationService;
}

function mockRepo(): AnalyticsRepositoryPort {
  return {
    getAuthorityAnalytics: vi.fn().mockResolvedValue(mockOverview),
  };
}

const baseCtx: RequestUserContext = {
  userId: "u1",
  user: { id: "u1", email: "officer@dev.netram.in", displayName: "Officer", type: "netram" },
  permissions: new Set(["report:read"]),
  assignments: [],
  requestId: "req-1",
  ipAddress: "127.0.0.1",
};

describe("AnalyticsService", () => {
  it("rejects when neither report:read nor project:read permission is present", async () => {
    const authz = mockAuthz([]);
    const repo = mockRepo();
    const svc = new AnalyticsService(authz, repo);

    await expect(svc.getOverview(baseCtx, {})).rejects.toThrow(AppError);
  });

  it("permits access when user has report:read", async () => {
    const authz = mockAuthz(["report:read"]);
    const repo = mockRepo();
    const svc = new AnalyticsService(authz, repo);

    const result = await svc.getOverview(baseCtx, {});
    expect(result.summary.totalProjects).toBe(10);
    expect(repo.getAuthorityAnalytics).toHaveBeenCalled();
  });

  it("permits access when user has project:read", async () => {
    const authz = mockAuthz(["project:read"]);
    const repo = mockRepo();
    const svc = new AnalyticsService(authz, repo);

    const result = await svc.getOverview(baseCtx, {});
    expect(result.summary.overallSlaComplianceRate).toBe(83.3);
  });

  it("rejects when districtId is outside user jurisdiction", async () => {
    const authz = mockAuthz(["report:read"]);
    const repo = mockRepo();
    const svc = new AnalyticsService(authz, repo);

    await expect(svc.getOverview(baseCtx, { districtId: "district-forbidden" })).rejects.toThrow(
      "District is outside your jurisdiction.",
    );
  });

  it("passes accessible district scope and filter to repository", async () => {
    const authz = mockAuthz(["report:read"]);
    const repo = mockRepo();
    const svc = new AnalyticsService(authz, repo);

    await svc.getOverview(baseCtx, { districtId: "district-allowed" });
    expect(repo.getAuthorityAnalytics).toHaveBeenCalledWith({
      accessibleDistrictIds: new Set(["district-allowed"]),
      filterDistrictId: "district-allowed",
      fromDate: undefined,
      toDate: undefined,
    });
  });
});
