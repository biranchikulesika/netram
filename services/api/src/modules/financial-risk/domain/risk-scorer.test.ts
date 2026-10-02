import { describe, expect, it } from "vitest";
import { scoreRiskResults } from "./risk-scorer.js";
import type { RuleEvaluationResult } from "./rule-evaluator.js";

describe("scoreRiskResults", () => {
  it("returns zero score and 'low' level when no rules trigger", () => {
    const results: RuleEvaluationResult[] = [];
    const output = scoreRiskResults(results);
    expect(output.totalScore).toBe(0);
    expect(output.riskLevel).toBe("low");
    expect(output.triggeredResults.length).toBe(0);
  });

  it("calculates total score and correctly classifies severity level", () => {
    const results: RuleEvaluationResult[] = [
      {
        triggered: true,
        ruleCode: "EXP-001",
        ruleName: "Over Allocation",
        severity: "high",
        scoreContribution: 30,
        detail: {},
        explanation: "Expenditure exceeds allocation",
        expenseId: "exp-1",
      },
      {
        triggered: true,
        ruleCode: "EXP-005",
        ruleName: "Duplicate Invoice",
        severity: "high",
        scoreContribution: 25,
        detail: {},
        explanation: "Duplicate invoice detected",
        expenseId: "exp-2",
      },
    ];

    const output = scoreRiskResults(results);
    expect(output.totalScore).toBe(55);
    expect(output.riskLevel).toBe("high");
    expect(output.triggeredResults.length).toBe(2);
    expect(output.explanation).toContain("[EXP-001]");
    expect(output.explanation).toContain("[EXP-005]");
    expect(output.evidenceRefs.length).toBe(2);
  });

  it("classifies >= 76 as 'critical'", () => {
    const results: RuleEvaluationResult[] = [
      {
        triggered: true,
        ruleCode: "EXP-010",
        ruleName: "Duplicate Hash",
        severity: "critical",
        scoreContribution: 80,
        detail: {},
        explanation: "Identical document hash uploaded",
      },
    ];

    const output = scoreRiskResults(results);
    expect(output.totalScore).toBe(80);
    expect(output.riskLevel).toBe("critical");
  });
});
