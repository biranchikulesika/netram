import { describe, expect, it } from "vitest";
import { CompositeRiskScorer } from "./composite-risk-scorer.js";
import type { ProjectRiskEvaluationContext } from "../application/project-risk-context.js";
import { validateRiskWeights, SCORING_VERSION } from "../config/risk-config.js";

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
    expect(result.scoringVersion).toBe(SCORING_VERSION);
    expect(result.scoringVersion).toBe("project-risk-v2");
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
            status: "closed",
            submittedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100d ago -> +15 recency
            createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        findings: [
          {
            id: "find-1",
            inspectionId: "insp-1",
            severity: "critical", // +30 pts
            status: "confirmed",
          },
        ],
        correctiveActions: [
          {
            id: "ca-1",
            findingId: "find-1",
            status: "pending",
            deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // overdue -> +25 pts
          },
        ],
      }, // Total inspection raw = 30 + 25 + 15 = 70. 70 * 25% = 17.5 pts
      attendance: {
        anomalies: [
          {
            id: "att-1",
            anomalyType: "CROSS_SOURCE_DISCREPANCY",
            severity: "CRITICAL", // +25 pts
            state: "NEW",
            operationalDate: "2026-09-01",
          },
        ],
      }, // 25 * 20% = 5 pts
      complaints: {
        complaints: [
          {
            id: "comp-1",
            status: "received", // open -> +25 pts
            receivedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      }, // 25 * 10% = 2.5 pts
      aiAnomalies: {
        anomalies: [
          {
            id: "ai-1",
            type: "equipment_discrepancy" as never,
            severity: "high", // +15 * 0.9 confidence = 13.5 pts
            status: "new",
            confidence: 0.9,
            createdAt: new Date().toISOString(),
          },
        ],
      }, // 13.5 rounded -> 14 * 5% = 0.7 pts
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
          { id: "f1", inspectionId: "i1", severity: "critical", status: "confirmed" },
          { id: "f2", inspectionId: "i1", severity: "critical", status: "confirmed" },
          { id: "f3", inspectionId: "i1", severity: "critical", status: "confirmed" },
        ], // 90 raw -> 90 * 25% = 22.5 pts
        correctiveActions: [
          { id: "ca1", findingId: "f1", status: "pending", deadline: new Date(Date.now() - 100000).toISOString() },
        ], // +25 raw -> capped 100 -> 25 pts
      },
      attendance: {
        anomalies: [
          { id: "a1", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a2", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a3", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a4", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
        ], // 100 raw -> 100 * 20% = 20 pts
      },
    });

    const result = scorer.calculateScore(ctx);
    // 40 + 25 + 25 + 20 = 110 (+10 synergy) -> clamped to 100 >= 75 -> critical
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
          { id: "a1", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a2", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
          { id: "a3", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "NEW", operationalDate: "2026-09-01" },
        ], // 75 raw -> >= 60% severe
      },
    });

    const result = scorer.calculateScore(ctx);
    expect(result.compoundBonus).toBe(5);
    expect(result.actionableDirectives?.length).toBeGreaterThan(0);
    expect(result.actionableDirectives?.some((d) => d.includes("PRIORITY AUDIT"))).toBe(true);
  });

  // ---------- Edge cases: review-state attenuation (§32, §36) ----------

  it("dismissed and false-positive attendance anomalies contribute zero risk (human review overrides detector)", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      attendance: {
        anomalies: [
          { id: "a1", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "DISMISSED", operationalDate: "2026-09-01" },
          { id: "a2", anomalyType: "HISTORICAL_DEVIATION", severity: "HIGH", state: "FALSE_POSITIVE", operationalDate: "2026-09-02" },
        ],
      },
    });

    const result = scorer.calculateScore(ctx);
    expect(result.dimensions.attendance_anomaly.rawScore).toBe(0);
    expect(result.dimensions.attendance_anomaly.normalizedScore).toBe(0);
    expect(result.totalScore).toBe(0);
    // Signals must still expose the dismissed volume for transparency.
    expect(result.dimensions.attendance_anomaly.signals.exoneratedCount).toBe(2);
  });

  it("actioned attendance anomalies retain only residual weight", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      attendance: {
        anomalies: [
          { id: "a1", anomalyType: "CROSS_SOURCE_DISCREPANCY", severity: "CRITICAL", state: "ACTIONED", operationalDate: "2026-09-01" },
        ],
      },
    });

    const result = scorer.calculateScore(ctx);
    // 25 * 0.25 attenuation = 6.25 -> normalized 6 -> 6 * 20% = 1.2 pts
    expect(result.dimensions.attendance_anomaly.rawScore).toBeCloseTo(6.25, 2);
    expect(result.dimensions.attendance_anomaly.normalizedScore).toBe(6);
  });

  it("dismissed AI anomalies contribute zero (the human decision overrides the advisory signal, §36)", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      aiAnomalies: {
        anomalies: [
          {
            id: "ai-1",
            type: "conflict",
            severity: "critical",
            status: "dismissed",
            confidence: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    const result = scorer.calculateScore(ctx);
    expect(result.dimensions.ai_anomaly.rawScore).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  it("weights each AI anomaly by its own confidence instead of an average", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      aiAnomalies: {
        anomalies: [
          {
            id: "ai-low",
            type: "conflict",
            severity: "critical", // base 25
            status: "new",
            confidence: 0.2, // -> 5
            createdAt: new Date().toISOString(),
          },
          {
            id: "ai-high",
            type: "conflict",
            severity: "critical", // base 25
            status: "new",
            confidence: 1.0, // -> 25
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    const result = scorer.calculateScore(ctx);
    // 5 + 25 = 30 raw (average-confidence model would have given 25*0.6*2 = 30
    // here but 15*0.2 + 15*1.0 = 18 vs per-anomaly 5+25=30 for high+low mixes
    // of differing severities; per-anomaly is the defensible semantic)
    expect(result.dimensions.ai_anomaly.rawScore).toBe(30);
    expect(result.dimensions.ai_anomaly.normalizedScore).toBe(30);
  });

  it("counts escalated complaints heavier than open ones and resolved ones not at all", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      complaints: {
        complaints: [
          { id: "c1", status: "escalated", receivedAt: new Date().toISOString() }, // +40
          { id: "c2", status: "resolved", receivedAt: new Date().toISOString() }, // +0
          { id: "c3", status: "closed", receivedAt: new Date().toISOString() }, // +0
        ],
      },
    });

    const result = scorer.calculateScore(ctx);
    expect(result.dimensions.complaint_density.rawScore).toBe(40);
    expect(result.dimensions.complaint_density.normalizedScore).toBe(40);
  });

  it("excludes dismissed findings from the inspection dimension (§32 authority review)", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      inspections: {
        inspections: [],
        findings: [
          { id: "f1", inspectionId: "i1", severity: "critical", status: "dismissed" },
          { id: "f2", inspectionId: "i1", severity: "critical", status: "confirmed" },
        ],
        correctiveActions: [],
      },
    });

    const result = scorer.calculateScore(ctx);
    // Only the confirmed critical finding scores: 30 raw -> 7.5 pts
    expect(result.dimensions.inspection_quality.rawScore).toBe(30);
  });

  it("treats accepted corrective actions as remediated (residual) and rejected ones as unremediated", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      inspections: {
        inspections: [],
        findings: [],
        correctiveActions: [
          { id: "ca1", findingId: "f1", status: "accepted", deadline: new Date(Date.now() - 100000).toISOString() },
          { id: "ca2", findingId: "f2", status: "rejected", deadline: new Date(Date.now() - 100000).toISOString() },
        ],
      },
    });

    const result = scorer.calculateScore(ctx);
    // accepted: 25 * 0.25 = 6.25 residual; rejected: +25 overdue-equivalent
    expect(result.dimensions.inspection_quality.rawScore).toBeCloseTo(31.25, 2);
    expect(result.dimensions.inspection_quality.signals.remediatedActionsCount).toBe(1);
    expect(result.dimensions.inspection_quality.signals.rejectedActionsCount).toBe(1);
  });

  it("does not read post-submission pipeline stages as 'never inspected'", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      project: {
        id: "project-1",
        code: "PRJ-001",
        name: "Test Project",
        status: "Active",
        districtId: "dist-1",
        organisationId: "org-1",
        // Project is old: the no-inspection branch would add +30.
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      },
      inspections: {
        inspections: [
          {
            id: "insp-1",
            status: "under_review",
            submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        findings: [],
        correctiveActions: [],
      },
    });

    const result = scorer.calculateScore(ctx);
    // Recent submission (5d ago) -> no recency penalty, no never-inspected penalty.
    expect(result.dimensions.inspection_quality.rawScore).toBe(0);
    expect(result.dimensions.inspection_quality.signals.daysSinceLastInspection).toBe(5);
  });

  it("clamps malformed future recency timestamps instead of producing negative staleness", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      inspections: {
        inspections: [
          {
            id: "insp-1",
            status: "closed",
            submittedAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1y in the future
            createdAt: new Date().toISOString(),
          },
        ],
        findings: [],
        correctiveActions: [],
      },
    });

    const result = scorer.calculateScore(ctx);
    expect(result.dimensions.inspection_quality.signals.daysSinceLastInspection).toBe(0);
    expect(result.dimensions.inspection_quality.rawScore).toBe(0);
  });

  it("fails safe on unknown severity/state values with a conservative default instead of silent zero", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      attendance: {
        anomalies: [
          {
            id: "a1",
            anomalyType: "CROSS_SOURCE_DISCREPANCY",
            severity: "catastrophic" as never, // unknown severity string
            state: "NEW",
            operationalDate: "2026-09-01",
          },
        ],
      },
      complaints: {
        complaints: [
          { id: "c1", status: "mysterious" as never, receivedAt: new Date().toISOString() },
        ],
      },
    });

    const result = scorer.calculateScore(ctx);
    // Attendance: unknown severity -> conservative MEDIUM-equivalent (+8)
    expect(result.dimensions.attendance_anomaly.rawScore).toBe(8);
    expect(result.dimensions.attendance_anomaly.signals.unknownSeverityCount).toBe(1);
    // Complaints: unknown status -> conservative open-equivalent (+25)
    expect(result.dimensions.complaint_density.rawScore).toBe(25);
    expect(result.dimensions.complaint_density.signals.unknownStatusCount).toBe(1);
  });

  it("treats an escalated complaint volume as a severe vector for the synergy bonus", () => {
    const scorer = new CompositeRiskScorer();
    const ctx = createDummyContext({
      complaints: {
        complaints: [
          { id: "c1", status: "escalated", receivedAt: new Date().toISOString() },
          { id: "c2", status: "escalated", receivedAt: new Date().toISOString() },
        ], // 80 raw -> normalized 80 >= 60 -> severe
      },
      financial: {
        totalScore: 160, // 160/220 = 73% -> severe
        riskLevel: "high",
        triggeredRules: [],
        maxPossibleRawScore: 220,
        allocationsCount: 1,
        expensesCount: 5,
        flagId: null,
      },
    });

    const result = scorer.calculateScore(ctx);
    expect(result.compoundBonus).toBe(5);
  });
});
