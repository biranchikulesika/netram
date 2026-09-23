import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

export class Exp008RoundNumberRule implements RuleEvaluator {
  readonly code = "EXP-008";
  readonly name = "Round Number Concentration";
  readonly category = "Vendor & Invoice Patterns";
  readonly defaultSeverity = "low" as const;
  readonly defaultWeight = 10;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      minAmount?: number;
      minExpensesCount?: number;
      maxRoundRatio?: number;
    };
    const minAmount = config.minAmount ?? 50000;
    const minExpensesCount = config.minExpensesCount ?? 10;
    const maxRoundRatio = config.maxRoundRatio ?? 0.40;

    const qualifyingExpenses = ctx.expenses.filter((e) => {
      if (e.status === "voided" || e.status === "rejected") return false;
      const amt = parseFloat(e.amount || "0");
      return amt >= minAmount;
    });

    if (qualifyingExpenses.length < minExpensesCount) {
      return [];
    }

    let roundCount = 0;
    for (const exp of qualifyingExpenses) {
      const amt = parseFloat(exp.amount || "0");
      // Round if cleanly divisible by 1000 with 0 paise
      if (amt % 1000 === 0) {
        roundCount++;
      }
    }

    const ratio = roundCount / qualifyingExpenses.length;
    if (ratio >= maxRoundRatio) {
      const pct = Math.round(ratio * 100);
      return [
        {
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          detail: {
            roundExpenseCount: roundCount,
            qualifyingExpenseCount: qualifyingExpenses.length,
            percentageRound: pct,
            minAmount,
          },
          explanation: `${pct}% of significant expenses (≥ ₹${minAmount.toLocaleString("en-IN")}) are exact round figures (multiples of ₹1,000), which is uncharacteristic of commercial retail invoices.`,
        },
      ];
    }

    return [];
  }
}
