import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

export class Exp002OverReleaseRule implements RuleEvaluator {
  readonly code = "EXP-002";
  readonly name = "Expenditure Exceeds Released Amount";
  readonly category = "Budget & Allocation";
  readonly defaultSeverity = "high" as const;
  readonly defaultWeight = 20;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const totalReleased = ctx.releases
      .filter((r) => r.status === "released")
      .reduce((sum, r) => sum + parseFloat(r.releasedAmount || "0"), 0);

    const totalExpense = ctx.expenses
      .filter((e) => e.status !== "voided" && e.status !== "rejected")
      .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    if (totalExpense > totalReleased && totalReleased > 0) {
      const excess = (totalExpense - totalReleased).toFixed(2);
      return [
        {
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          detail: {
            totalReleased: totalReleased.toFixed(2),
            totalExpense: totalExpense.toFixed(2),
            excessAmount: excess,
          },
          explanation: `Project recorded expenditures (₹${totalExpense.toLocaleString("en-IN")}) exceeding disbursed funds (₹${totalReleased.toLocaleString("en-IN")}) by ₹${parseFloat(excess).toLocaleString("en-IN")}.`,
        },
      ];
    }

    return [];
  }
}
