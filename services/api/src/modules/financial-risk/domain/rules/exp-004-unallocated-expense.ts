import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

export class Exp004UnallocatedExpenseRule implements RuleEvaluator {
  readonly code = "EXP-004";
  readonly name = "Unallocated or Cancelled Allocation Expenditure";
  readonly category = "Budget & Allocation";
  readonly defaultSeverity = "high" as const;
  readonly defaultWeight = 20;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const activeAllocationIds = new Set(
      ctx.allocations.filter((a) => a.status === "active").map((a) => a.id),
    );

    const cancelledAllocationIds = new Set(
      ctx.allocations.filter((a) => a.status === "cancelled").map((a) => a.id),
    );

    const results: RuleEvaluationResult[] = [];

    for (const expense of ctx.expenses) {
      if (expense.status === "voided" || expense.status === "rejected") continue;

      if (expense.allocationId) {
        if (cancelledAllocationIds.has(expense.allocationId)) {
          results.push({
            triggered: true,
            ruleCode: this.code,
            ruleName: this.name,
            severity: rule.severity,
            scoreContribution: rule.weight,
            expenseId: expense.id,
            allocationId: expense.allocationId,
            detail: {
              expenseId: expense.id,
              allocationId: expense.allocationId,
              amount: expense.amount,
              reason: "Allocation has been cancelled",
            },
            explanation: `Expense of ₹${parseFloat(expense.amount).toLocaleString("en-IN")} submitted against a cancelled budget allocation.`,
          });
        } else if (!activeAllocationIds.has(expense.allocationId)) {
          results.push({
            triggered: true,
            ruleCode: this.code,
            ruleName: this.name,
            severity: rule.severity,
            scoreContribution: rule.weight,
            expenseId: expense.id,
            allocationId: expense.allocationId,
            detail: {
              expenseId: expense.id,
              allocationId: expense.allocationId,
              amount: expense.amount,
              reason: "Allocation is inactive or not found",
            },
            explanation: `Expense of ₹${parseFloat(expense.amount).toLocaleString("en-IN")} submitted against an unapproved or inactive allocation.`,
          });
        }
      }
    }

    return results;
  }
}
