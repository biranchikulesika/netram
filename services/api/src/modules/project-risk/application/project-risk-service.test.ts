import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectRiskService } from "./project-risk-service.js";
import { CompositeRiskScorer } from "../domain/composite-risk-scorer.js";
import { InspectionScheduler } from "./inspection-scheduler.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRiskEvaluationContext } from "./project-risk-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { ProjectRiskContextBuilder } from "./project-risk-context-builder.js";
import type { ProjectRiskRepository, InspectionFlagRepository, AuditRepository } from "@netram/data";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { CompositeRiskScore } from "@netram/types";

const mockCtx: RequestUserContext = {
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "officer@netram.gov.in",
    displayName: "Authorized Officer",
    type: "netram",
  },
  userId: "00000000-0000-0000-0000-000000000001",
  assignments: [],
  permissions: new Set(["*"]),
  requestId: "req-test-1",
  ipAddress: "127.0.0.1",
};

describe("ProjectRiskService - End-to-End Scenarios (Cases A to H)", () => {
  let mockAuthz: { requirePermission: ReturnType<typeof vi.fn>; accessibleDistrictIds: ReturnType<typeof vi.fn> };
  let mockContextBuilder: { buildContext: ReturnType<typeof vi.fn> };
  let scorer: CompositeRiskScorer;
  let mockScheduler: { evaluateAndSchedule: ReturnType<typeof vi.fn> };
  let mockProjectRiskRepo: {
    insertSnapshot: ReturnType<typeof vi.fn>;
    findAllActiveProjects: ReturnType<typeof vi.fn>;
    listRanked: ReturnType<typeof vi.fn>;
    findRecentSnapshots: ReturnType<typeof vi.fn>;
    findLatestByProject: ReturnType<typeof vi.fn>;
    hasOpenInspection: ReturnType<typeof vi.fn>;
    getLastInspectionDates: ReturnType<typeof vi.fn>;
  };
  let mockAuditRepo: { append: ReturnType<typeof vi.fn> };
  let service: ProjectRiskService;

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(null),
    };
    mockContextBuilder = {
      buildContext: vi.fn(),
    };
    scorer = new CompositeRiskScorer();
    mockScheduler = {
      evaluateAndSchedule: vi.fn(),
    };
    mockProjectRiskRepo = {
      insertSnapshot: vi.fn().mockImplementation((p) => ({
        id: "snapshot-1",
        ...p,
        calculatedAt: p.calculatedAt.toISOString(),
        createdAt: new Date().toISOString(),
      })),
      findAllActiveProjects: vi.fn(),
      listRanked: vi.fn(),
      findRecentSnapshots: vi.fn(),
      findLatestByProject: vi.fn(),
      hasOpenInspection: vi.fn(),
      getLastInspectionDates: vi.fn(),
    };
    mockAuditRepo = {
      append: vi.fn().mockResolvedValue(undefined),
    };

    service = new ProjectRiskService(
      mockAuthz as unknown as AuthorizationService,
      mockContextBuilder as unknown as ProjectRiskContextBuilder,
      scorer,
      mockScheduler as unknown as InspectionScheduler,
      mockProjectRiskRepo as unknown as ProjectRiskRepository,
      mockAuditRepo as unknown as AuditRepository,
    );
  });

  // Case A: Zero discrepancies project
  it("Case A: Evaluates zero-discrepancy project as CRS = 0, Low risk, no scheduling", async () => {
    const emptyCtx: ProjectRiskEvaluationContext = {
      project: {
        id: "p-clean",
        code: "PRJ-CLEAN",
        name: "Clean Project",
        status: "Active",
        districtId: "dist-1",
        organisationId: "org-1",
        createdAt: new Date().toISOString(),
      },
      financial: {
        totalScore: 0,
        riskLevel: "low",
        triggeredRules: [],
        maxPossibleRawScore: 220,
        allocationsCount: 1,
        expensesCount: 2,
        flagId: null,
      },
      inspections: { inspections: [], findings: [], correctiveActions: [] },
      attendance: { anomalies: [] },
      complaints: { complaints: [] },
      aiAnomalies: { anomalies: [] },
    };
    mockContextBuilder.buildContext.mockResolvedValue(emptyCtx);
    mockScheduler.evaluateAndSchedule.mockResolvedValue({
      projectId: "p-clean",
      shouldSchedule: false,
      reason: "Below threshold",
      actionTaken: "threshold_not_met",
    });

    const snapshot = await service.evaluateProject(mockCtx, "p-clean");

    expect(snapshot.totalScore).toBe(0);
    expect(snapshot.riskLevel).toBe("low");
    expect(snapshot.scheduledInspectionId).toBeNull();
    expect(mockAuditRepo.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project_risk.evaluated", resourceId: "p-clean" }),
    );
  });

  // Case B: Single dimension high financial risk
  it("Case B: High financial risk alone yields Medium risk (CRS ~ 35), below auto-schedule threshold (50)", async () => {
    const financialOnlyCtx: ProjectRiskEvaluationContext = {
      project: {
        id: "p-fin",
        code: "PRJ-FIN",
        name: "Financial Discrepancy Project",
        status: "Active",
        districtId: "dist-1",
        organisationId: "org-1",
        createdAt: new Date().toISOString(),
      },
      financial: {
        totalScore: 190, // Raw score 190/220 = 86% normalized * 40 weight = ~35 pts
        riskLevel: "high",
        triggeredRules: [
          { ruleCode: "EXP-001", ruleName: "Over Allocation", scoreContribution: 30 },
          { ruleCode: "EXP-005", ruleName: "Duplicate Invoice", scoreContribution: 80 },
          { ruleCode: "EXP-010", ruleName: "Duplicate Hash", scoreContribution: 80 },
        ],
        maxPossibleRawScore: 220,
        allocationsCount: 1,
        expensesCount: 15,
        flagId: "flag-fin-1",
      },
      inspections: { inspections: [], findings: [], correctiveActions: [] },
      attendance: { anomalies: [] },
      complaints: { complaints: [] },
      aiAnomalies: { anomalies: [] },
    };
    mockContextBuilder.buildContext.mockResolvedValue(financialOnlyCtx);
    mockScheduler.evaluateAndSchedule.mockResolvedValue({
      projectId: "p-fin",
      shouldSchedule: false,
      reason: "Below threshold 50",
      actionTaken: "threshold_not_met",
    });

    const snapshot = await service.evaluateProject(mockCtx, "p-fin");

    expect(snapshot.totalScore).toBeGreaterThanOrEqual(30);
    expect(snapshot.totalScore).toBeLessThan(50);
    expect(snapshot.riskLevel).toBe("medium");
    expect(snapshot.topContributors[0]!.dimension).toBe("financial");
    expect(snapshot.scheduledInspectionId).toBeNull();
  });

  // Case C: Multi-dimensional risk crossing threshold
  it("Case C: Multi-dimensional risk crossing threshold (CRS ≥ 50) triggers auto-schedule", async () => {
    const multiRiskCtx: ProjectRiskEvaluationContext = {
      project: {
        id: "p-multi",
        code: "PRJ-MULTI",
        name: "Multi-Discrepancy Project",
        status: "Active",
        districtId: "dist-1",
        organisationId: "org-1",
        createdAt: new Date().toISOString(),
      },
      financial: {
        totalScore: 140, // 140/220 = 64% normalized * 40 weight = 25.5 pts
        riskLevel: "high",
        triggeredRules: [{ ruleCode: "EXP-001", ruleName: "Over", scoreContribution: 140 }],
        maxPossibleRawScore: 220,
        allocationsCount: 1,
        expensesCount: 5,
        flagId: null,
      },
      inspections: {
        inspections: [],
        findings: [{ id: "f1", inspectionId: "i1", severity: "critical", status: "confirmed" }], // 30 raw * 25% = 7.5 pts
        correctiveActions: [{ id: "ca1", findingId: "f1", status: "pending", deadline: new Date(Date.now() - 100000).toISOString() }], // +25 overdue
      },
      attendance: {
        anomalies: [
          { id: "a1", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a2", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "HIGH", state: "NEW", operationalDate: "2026-09-01" },
        ], // 40 raw * 20% = 8 pts
      },
      complaints: {
        complaints: [
          { id: "c1", status: "received", receivedAt: new Date().toISOString() },
          { id: "c2", status: "received", receivedAt: new Date().toISOString() },
        ], // 50 raw * 10% = 5 pts
      },
      aiAnomalies: { anomalies: [] },
    };
    mockContextBuilder.buildContext.mockResolvedValue(multiRiskCtx);
    mockScheduler.evaluateAndSchedule.mockResolvedValue({
      projectId: "p-multi",
      shouldSchedule: true,
      reason: "High risk score (54) exceeded threshold (50)",
      actionTaken: "scheduled",
      inspectionId: "insp-created-123",
      inspectionFlagId: "flag-created-456",
    });

    const snapshot = await service.evaluateProject(mockCtx, "p-multi");

    expect(snapshot.totalScore).toBeGreaterThanOrEqual(50);
    expect(snapshot.riskLevel).toBe("high");
    expect(snapshot.scheduledInspectionId).toBe("insp-created-123");
    expect(snapshot.inspectionFlagId).toBe("flag-created-456");
  });

  // Case D: Deduplication guard
  it("Case D: Skips scheduling when an open inspection is already in progress", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(true),
      getLastInspectionDates: vi.fn().mockResolvedValue({ lastCompletedAt: null, lastScheduledAt: null }),
    };
    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      {} as unknown as InspectionFlagRepository,
      {} as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(
      mockCtx,
      "p-dup",
      { totalScore: 68, riskLevel: "high", dimensions: {} as unknown as CompositeRiskScore["dimensions"], topContributors: [], calculatedAt: "", scoringVersion: "" },
    );

    expect(decision.shouldSchedule).toBe(false);
    expect(decision.actionTaken).toBe("existing_open_inspection_skipped");
  });

  // Case E: Cooldown enforcement
  it("Case E: Skips scheduling when within 7-day cooldown for non-critical score", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(false),
      getLastInspectionDates: vi.fn().mockResolvedValue({
        lastCompletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        lastScheduledAt: null,
      }),
    };
    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      {} as unknown as InspectionFlagRepository,
      {} as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(
      mockCtx,
      "p-cool",
      { totalScore: 65, riskLevel: "high", dimensions: {} as unknown as CompositeRiskScore["dimensions"], topContributors: [], calculatedAt: "", scoringVersion: "" },
    );

    expect(decision.shouldSchedule).toBe(false);
    expect(decision.actionTaken).toBe("cooldown_skipped");
  });

  // Case F: Critical override
  it("Case F: Critical risk score (CRS ≥ 75) bypasses cooldown", async () => {
    const mockRiskRepo = {
      hasOpenInspection: vi.fn().mockResolvedValue(false),
      getLastInspectionDates: vi.fn().mockResolvedValue({
        lastCompletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (< 7d cooldown)
        lastScheduledAt: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 hours ago (> 12h guard)
      }),
    };
    const mockFlagRepo = {
      findOpenFlagByProject: vi.fn().mockResolvedValue({ id: "flag-crit" }),
      linkInspectionWithAudit: vi.fn().mockResolvedValue({ id: "flag-crit" }),
    };
    const mockInspectionService = {
      createInspection: vi.fn().mockResolvedValue({ id: "insp-crit-1" }),
    };

    const scheduler = new InspectionScheduler(
      mockRiskRepo as unknown as ProjectRiskRepository,
      mockFlagRepo as unknown as InspectionFlagRepository,
      mockInspectionService as unknown as Pick<InspectionService, "createInspection">,
    );

    const decision = await scheduler.evaluateAndSchedule(
      mockCtx,
      "p-crit",
      { totalScore: 82, riskLevel: "critical", dimensions: {} as unknown as CompositeRiskScore["dimensions"], topContributors: [], calculatedAt: "", scoringVersion: "" },
    );

    expect(decision.shouldSchedule).toBe(true);
    expect(decision.actionTaken).toBe("scheduled");
    expect(decision.inspectionId).toBe("insp-crit-1");
    expect(decision.reason).toContain("Critical risk score");
  });

  // Case G: Leaderboard & Ranking Query
  it("Case G: listRankings returns ranked leaderboard with district and open inspection metadata", async () => {
    const expectedRankings = {
      items: [
        {
          rank: 1,
          projectId: "p-1",
          projectCode: "PRJ-001",
          projectName: "High Risk Project",
          districtId: "d-1",
          districtName: "Central District",
          totalScore: 78,
          riskLevel: "critical" as const,
          topContributors: [{ dimension: "financial", contribution: 35, percentage: 45, explanation: "High Cash Spend" }],
          lastCalculatedAt: new Date().toISOString(),
          openInspectionCount: 0,
          hasOpenFlag: true,
          scoringVersion: "project-risk-v1",
        },
        {
          rank: 2,
          projectId: "p-2",
          projectCode: "PRJ-002",
          projectName: "Moderate Risk Project",
          districtId: "d-1",
          districtName: "Central District",
          totalScore: 32,
          riskLevel: "medium" as const,
          topContributors: [],
          lastCalculatedAt: new Date().toISOString(),
          openInspectionCount: 1,
          hasOpenFlag: false,
          scoringVersion: "project-risk-v1",
        },
      ],
      total: 2,
    };
    mockProjectRiskRepo.listRanked.mockResolvedValue(expectedRankings);

    const result = await service.listRankings(mockCtx, { page: 1, pageSize: 10 });

    expect(result.items.length).toBe(2);
    expect(result.items[0]!.rank).toBe(1);
    expect(result.items[0]!.totalScore).toBe(78);
    expect(result.items[0]!.riskLevel).toBe("critical");
    expect(result.items[1]!.rank).toBe(2);
    expect(result.items[1]!.totalScore).toBe(32);
  });

  // Case H: Historical Snapshots Query
  it("Case H: getRecentSnapshots retrieves time-series snapshots for trend analysis", async () => {
    const expectedSnapshots = [
      {
        id: "snap-2",
        projectId: "p-1",
        calculatedAt: new Date(Date.now() - 3600000).toISOString(),
        totalScore: 65,
        riskLevel: "high" as const,
        financialScore: 30,
        inspectionQualityScore: 15,
        attendanceAnomalyScore: 10,
        complaintDensityScore: 5,
        aiAnomalyScore: 5,
        topContributors: [],
        explanation: "High risk snapshot",
      },
      {
        id: "snap-1",
        projectId: "p-1",
        calculatedAt: new Date(Date.now() - 86400000).toISOString(),
        totalScore: 40,
        riskLevel: "medium" as const,
        financialScore: 20,
        inspectionQualityScore: 10,
        attendanceAnomalyScore: 5,
        complaintDensityScore: 5,
        aiAnomalyScore: 0,
        topContributors: [],
        explanation: "Medium risk snapshot",
      },
    ];
    mockProjectRiskRepo.findRecentSnapshots.mockResolvedValue(expectedSnapshots);

    const snapshots = await service.getRecentSnapshots(mockCtx, { projectId: "p-1", limit: 10 });

    expect(snapshots.length).toBe(2);
    expect(snapshots[0]!.totalScore).toBe(65);
    expect(snapshots[1]!.totalScore).toBe(40);
  });

  // Case I: Sweep resilience - one failing project must not abort the sweep,
  // and the failure must be observable in the result (§53, §29).
  it("Case I: sweep continues past a failing project and reports the failure", async () => {
    mockProjectRiskRepo.findAllActiveProjects.mockResolvedValue([
      { id: "p-broken" },
      { id: "p-ok" },
    ]);
    mockContextBuilder.buildContext.mockImplementation((_ctx: unknown, projectId: string) => {
      if (projectId === "p-broken") {
        return Promise.reject(new Error("context build exploded"));
      }
      return Promise.resolve(emptyScenarioContext("p-ok"));
    });
    mockScheduler.evaluateAndSchedule.mockResolvedValue({
      projectId: "p-ok",
      shouldSchedule: false,
      reason: "Below threshold",
      actionTaken: "threshold_not_met",
    });

    const result = await service.sweepAllActiveProjects(mockCtx);

    expect(result.evaluatedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failedProjectIds).toEqual(["p-broken"]);
    expect(result.scheduledCount).toBe(0);
  });

  // Scheduling failure: the risk score is still valid and must survive (with
  // the failure recorded), rather than being silently discarded.
  it("keeps the risk score and records the failure when inspection scheduling throws", async () => {
    mockContextBuilder.buildContext.mockResolvedValue(emptyScenarioContext("p-high"));
    mockScheduler.evaluateAndSchedule.mockRejectedValue(new Error("scheduling db down"));

    const snapshot = await service.evaluateProject(mockCtx, "p-high");

    expect(mockProjectRiskRepo.insertSnapshot).toHaveBeenCalled();
    expect(snapshot.totalScore).toBeGreaterThanOrEqual(0);
    expect(mockAuditRepo.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project_risk.evaluated",
        resourceId: "p-high",
        metadata: expect.objectContaining({ schedulingFailed: true }),
      }),
    );
  });
});

/** Minimal clean-project evaluation context for sweep scenarios. */
function emptyScenarioContext(projectId: string): ProjectRiskEvaluationContext {
  return {
    project: {
      id: projectId,
      code: `PRJ-${projectId.toUpperCase()}`,
      name: "Scenario Project",
      status: "Active",
      districtId: "dist-1",
      organisationId: "org-1",
      createdAt: new Date().toISOString(),
    },
    financial: {
      totalScore: 0,
      riskLevel: "low",
      triggeredRules: [],
      maxPossibleRawScore: 220,
      allocationsCount: 1,
      expensesCount: 2,
      flagId: null,
    },
    inspections: { inspections: [], findings: [], correctiveActions: [] },
    attendance: { anomalies: [] },
    complaints: { complaints: [] },
    aiAnomalies: { anomalies: [] },
  };
}
