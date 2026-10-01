import type { FinancialRiskRule } from "@netram/types";
import type {
  RiskEvaluationContext,
  RuleEvaluationResult,
  RuleEvaluator,
} from "../rule-evaluator.js";

export class Exp001OverAllocationRule implements RuleEvaluator {
  readonly code = "EXP-001";
  readonly name = "Total Expenditure Exceeds Sanctioned Allocation";
  readonly category = "Budget & Allocation";
  readonly defaultSeverity = "critical" as const;
  readonly defaultWeight = 25;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const totalAllocated = ctx.allocations
      .filter((a) => a.status === "active")
      .reduce((sum, a) => sum + parseFloat(a.allocatedAmount || "0"), 0);

    const totalExpense = ctx.expenses
      .filter((e) => e.status !== "voided" && e.status !== "rejected")
      .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    if (totalExpense > totalAllocated && totalAllocated > 0) {
      const excess = (totalExpense - totalAllocated).toFixed(2);
      return [
        {
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          detail: {
            totalAllocated: totalAllocated.toFixed(2),
            totalExpense: totalExpense.toFixed(2),
            excessAmount: excess,
          },
          explanation: `Total project expenditure (₹${totalExpense.toLocaleString("en-IN")}) exceeds sanctioned allocation (₹${totalAllocated.toLocaleString("en-IN")}) by ₹${parseFloat(excess).toLocaleString("en-IN")}.`,
        },
      ];
    }

    return [];
  }
}
