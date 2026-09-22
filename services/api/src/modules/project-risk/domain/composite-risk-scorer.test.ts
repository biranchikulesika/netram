import { describe, expect, it } from "vitest";
import { CompositeRiskScorer } from "./composite-risk-scorer.js";
import type { ProjectRiskEvaluationContext } from "../application/project-risk-context.js";
import { validateRiskWeights } from "../config/risk-config.js";

function createDummyContext(overrides?: Partial<ProjectRiskEvaluationContext>): ProjectRiskEvaluationContext {
  return {
    project: {
      id: "project-1",
      code: "PRJ-001",
      name: "Test Project",
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
      expensesCount: 5,
      flagId: null,
    },
    inspections: {
      inspections: [],
      findings: [],
      correctiveActions: [],
    },
    attendance: {
      anomalies: [],
    },
    complaints: {
      complaints: [],
    },
    aiAnomalies: {
      anomalies: [],
    },
    ...overrides,
  };
}

describe("CompositeRiskScorer", () => {
  it("validates that dimension weights must sum to 100", () => {
    expect(() =>
      validateRiskWeights({
        financial: 40,
        inspectionQuality: 25,
        attendanceAnomaly: 20,
        complaintDensity: 10,
        aiAnomaly: 10, // sums to 105
      }),
    ).toThrow(/Risk weights must sum to 100/);

    expect(() =>
      validateRiskWeights({
        financial: 40,
        inspectionQuality: 25,
        attendanceAnomaly: 20,
        complaintDensity: 10,
        aiAnomaly: 5, // sums to 100
      }),
    ).not.toThrow();
  });

  it("produces score 0 and level 'low' for project with no discrepancies", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext();
    const result = scorer.calculateScore(ctx);

    expect(result.totalScore).toBe(0);
    expect(result.riskLevel).toBe("low");
    expect(result.topContributors.length).toBe(0);
    expect(result.scoringVersion).toBe("project-risk-v1");
  });

  it("calculates accurate weighted contribution across all 5 dimensions", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      financial: {
        totalScore: 110, // 110/220 = 50% normalized * 40 weight = 20 pts
        riskLevel: "medium",
        triggeredRules: [
          {
            ruleCode: "EXP-001",
            ruleName: "Over Allocation",
            scoreContribution: 30,
          },
          {
            ruleCode: "EXP-004",
            ruleName: "High Cash Spend",
            scoreContribution: 80,
          },
        ],
        maxPossibleRawScore: 220,
        allocationsCount: 1,
        expensesCount: 10,
        flagId: "flag-1",
      },
      inspections: {
        inspections: [
          {
            id: "insp-1",
            status: "completed",
            submittedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100d ago -> +15 recency
            createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        findings: [
          {
            id: "find-1",
            inspectionId: "insp-1",
            severity: "critical", // +30 pts
            status: "open",
          },
        ],
        correctiveActions: [
          {
            id: "ca-1",
            findingId: "find-1",
            status: "action_required",
            deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // overdue -> +25 pts
          },
        ],
      }, // Total inspection raw = 30 + 25 + 15 = 70. 70 * 25% = 17.5 pts
      attendance: {
        anomalies: [
          {
            id: "att-1",
            anomalyType: "CROSS_SOURCE_DISCREPANCY",
            severity: "critical", // +25 pts
            state: "NEW",
            operationalDate: "2026-09-01",
          },
        ],
      }, // 25 * 20% = 5 pts
      complaints: {
        complaints: [
          {
            id: "comp-1",
            status: "submitted", // open -> +25 pts
            receivedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      }, // 25 * 10% = 2.5 pts
      aiAnomalies: {
        anomalies: [
          {
            id: "ai-1",
            type: "equipment_discrepancy",
            severity: "high", // +15 * 0.9 = 13.5 pts
            status: "new",
            confidence: 0.9,
            createdAt: new Date().toISOString(),
          },
        ],
      }, // 14 * 5% = 0.7 pts
    });

    const result = scorer.calculateScore(ctx);

    // Expected: ~20 + 17.5 + 5 + 2.5 + 0.7 = 45.7 -> Math.round -> 46
    expect(result.totalScore).toBeGreaterThanOrEqual(44);
    expect(result.totalScore).toBeLessThanOrEqual(48);
    expect(result.riskLevel).toBe("medium");

    // Check top contributors ordering
    expect(result.topContributors.length).toBeGreaterThan(1);
    expect(result.topContributors[0]!.contribution).toBeGreaterThanOrEqual(
      result.topContributors[1]!.contribution,
    );
    expect(result.dimensions.financial.weightedContribution).toBe(20);
    expect(result.dimensions.financial.signals.ruleCount).toBe(2);
  });

  it("classifies score >= 75 as 'critical'", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      financial: {
        totalScore: 220, // 100% normalized * 40 = 40 pts
        riskLevel: "critical",
        triggeredRules: [],
        maxPossibleRawScore: 220,
        allocationsCount: 1,
        expensesCount: 10,
        flagId: null,
      },
      inspections: {
        inspections: [],
        findings: [
          { id: "f1", inspectionId: "i1", severity: "critical", status: "open" },
          { id: "f2", inspectionId: "i1", severity: "critical", status: "open" },
          { id: "f3", inspectionId: "i1", severity: "critical", status: "open" },
        ], // 90 raw -> 90 * 25% = 22.5 pts
        correctiveActions: [
          { id: "ca1", findingId: "f1", status: "open", deadline: new Date(Date.now() - 100000).toISOString() },
        ], // +25 raw -> capped 100 -> 25 pts
      },
      attendance: {
        anomalies: [
          { id: "a1", anomalyType: "GHOST_WORKER", severity: "critical", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a2", anomalyType: "GHOST_WORKER", severity: "critical", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a3", anomalyType: "GHOST_WORKER", severity: "critical", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a4", anomalyType: "GHOST_WORKER", severity: "critical", state: "NEW", operationalDate: "2026-09-01" },
        ], // 100 raw -> 100 * 20% = 20 pts
      },
    });

    const result = scorer.calculateScore(ctx);
    // 40 + 25 + 20 = 85 pts >= 75 -> critical
    expect(result.totalScore).toBeGreaterThanOrEqual(75);
    expect(result.riskLevel).toBe("critical");
  });

  it("applies compound synergy bonus and generates actionable directives for multi-vector risks", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      financial: {
        totalScore: 160, // 160/220 = 72.7% -> >= 60% severe
        riskLevel: "high",
        triggeredRules: [{ ruleCode: "EXP-001", ruleName: "Over Allocation", scoreContribution: 160 }],
        maxPossibleRawScore: 220,
        allocationsCount: 1,
        expensesCount: 5,
        flagId: "flag-f",
      },
      attendance: {
        anomalies: [
          { id: "a1", anomalyType: "GHOST_WORKER", severity: "critical", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a2", anomalyType: "GHOST_WORKER", severity: "critical", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a3", anomalyType: "GHOST_WORKER", severity: "critical", state: "NEW", operationalDate: "2026-09-01" },
        ], // 75 raw -> >= 60% severe
      },
    });

    const result = scorer.calculateScore(ctx);
    expect(result.compoundBonus).toBe(5);
    expect(result.actionableDirectives?.length).toBeGreaterThan(0);
    expect(result.actionableDirectives?.some((d) => d.includes("PRIORITY AUDIT"))).toBe(true);
  });
});

