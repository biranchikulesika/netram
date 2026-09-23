import { describe, expect, it, vi } from "vitest";
import { InspectionScheduler } from "./inspection-scheduler.js";
import type { CompositeRiskScore } from "@netram/types";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRiskRepository, InspectionFlagRepository } from "@netram/data";
import type { InspectionService } from "../../inspections/application/inspection-service.js";

const mockCtx: RequestUserContext = {
  user: {
    id: "user-1",
    email: "officer@netram.gov.in",
    displayName: "Officer",
    type: "netram",
  },
  userId: "user-1",
  assignments: [],
  permissions: new Set(["*"]),
  requestId: "req-1",
  ipAddress: "127.0.0.1",
};

function createMockScore(totalScore: number): CompositeRiskScore {
  return {
    totalScore,
    riskLevel: totalScore >= 75 ? "critical" : totalScore >= 50 ? "high" : "low",
    dimensions: {} as unknown as CompositeRiskScore["dimensions"],
    topContributors: [
      {
        dimension: "financial",
        contribution: 25,
        percentage: 50,
        explanation: "Financial risk discrepancy",
      },
    ],
    calculatedAt: new Date().toISOString(),
    scoringVersion: "project-risk-v1",
  };
}

describe("InspectionScheduler", () => {
  it("skips scheduling when score is below threshold", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(false),
      getLastInspectionDates: vi.fn().mockResolvedValue({ lastCompletedAt: null, lastScheduledAt: null }),
    };
    const mockFlagRepo = {
      findOpenFlagByProject: vi.fn(),
      createWithAudit: vi.fn(),
      linkInspectionWithAudit: vi.fn(),
    };
    const mockInspectionService = {
      createInspection: vi.fn(),
    };

    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      mockFlagRepo as unknown as InspectionFlagRepository,
      mockInspectionService as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(mockCtx, "p-1", createMockScore(42));
    expect(decision.shouldSchedule).toBe(false);
    expect(decision.actionTaken).toBe("threshold_not_met");
    expect(mockInspectionService.createInspection).not.toHaveBeenCalled();
  });

  it("skips scheduling when project already has an active open inspection", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(true),
      getLastInspectionDates: vi.fn().mockResolvedValue({ lastCompletedAt: null, lastScheduledAt: null }),
    };
    const mockFlagRepo = {
      findOpenFlagByProject: vi.fn(),
      createWithAudit: vi.fn(),
      linkInspectionWithAudit: vi.fn(),
    };
    const mockInspectionService = {
      createInspection: vi.fn(),
    };

    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      mockFlagRepo as unknown as InspectionFlagRepository,
      mockInspectionService as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(mockCtx, "p-1", createMockScore(65));
    expect(decision.shouldSchedule).toBe(false);
    expect(decision.actionTaken).toBe("existing_open_inspection_skipped");
    expect(mockInspectionService.createInspection).not.toHaveBeenCalled();
  });

  it("skips scheduling when within 7-day cooldown for non-critical score", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(false),
      getLastInspectionDates: vi.fn().mockResolvedValue({
        lastCompletedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (< 7d cooldown)
        lastScheduledAt: null,
      }),
    };
    const mockFlagRepo = {
      findOpenFlagByProject: vi.fn(),
      createWithAudit: vi.fn(),
      linkInspectionWithAudit: vi.fn(),
    };
    const mockInspectionService = {
      createInspection: vi.fn(),
    };

    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      mockFlagRepo as unknown as InspectionFlagRepository,
      mockInspectionService as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(mockCtx, "p-1", createMockScore(65)); // 65 is high, not critical
    expect(decision.shouldSchedule).toBe(false);
    expect(decision.actionTaken).toBe("cooldown_skipped");
    expect(decision.reason).toContain("cooldown active");
    expect(mockInspectionService.createInspection).not.toHaveBeenCalled();
  });

  it("bypasses cooldown when score is critical (>= 75)", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(false),
      getLastInspectionDates: vi.fn().mockResolvedValue({
        lastCompletedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (< 7d cooldown)
        lastScheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago (> 12h same day guard)
      }),
    };
    const mockFlagRepo = {
      findOpenFlagByProject: vi.fn().mockResolvedValue(null),
      createWithAudit: vi.fn().mockResolvedValue({ id: "flag-new", status: "open" }),
      linkInspectionWithAudit: vi.fn().mockResolvedValue({ id: "flag-new", status: "inspection_in_progress" }),
    };
    const mockInspectionService = {
      createInspection: vi.fn().mockResolvedValue({ id: "insp-new", status: "assigned" }),
    };

    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      mockFlagRepo as unknown as InspectionFlagRepository,
      mockInspectionService as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(mockCtx, "p-1", createMockScore(82)); // 82 >= 75 Critical
    expect(decision.shouldSchedule).toBe(true);
    expect(decision.actionTaken).toBe("scheduled");
    expect(decision.inspectionId).toBe("insp-new");
    expect(decision.reason).toContain("Critical risk score");
    expect(mockInspectionService.createInspection).toHaveBeenCalledWith(
      mockCtx,
      expect.objectContaining({
        projectId: "p-1",
        trigger: "risk_engine",
        type: "special",
      }),
    );
    expect(mockFlagRepo.linkInspectionWithAudit).toHaveBeenCalledWith("flag-new", "insp-new", mockCtx.userId);
  });

  it("enforces same-day guard even for critical scores if scheduled < 12h ago", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(false),
      getLastInspectionDates: vi.fn().mockResolvedValue({
        lastCompletedAt: null,
        lastScheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago (< 12h)
      }),
    };
    const mockFlagRepo = {
      findOpenFlagByProject: vi.fn(),
      createWithAudit: vi.fn(),
      linkInspectionWithAudit: vi.fn(),
    };
    const mockInspectionService = {
      createInspection: vi.fn(),
    };

    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      mockFlagRepo as unknown as InspectionFlagRepository,
      mockInspectionService as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(mockCtx, "p-1", createMockScore(90));
    expect(decision.shouldSchedule).toBe(false);
    expect(decision.actionTaken).toBe("cooldown_skipped");
    expect(decision.reason).toContain("past 12 hours");
    expect(mockInspectionService.createInspection).not.toHaveBeenCalled();
  });
});
