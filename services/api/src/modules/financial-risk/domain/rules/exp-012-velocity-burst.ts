import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

export class Exp012VelocityBurstRule implements RuleEvaluator {
  readonly code = "EXP-012";
  readonly name = "Off-Hours / Sudden Transaction Velocity Burst";
  readonly category = "Velocity & Operational Correlation";
  readonly defaultSeverity = "medium" as const;
  readonly defaultWeight = 15;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      burstCount?: number;
      windowHours?: number;
    };
    const burstCount = config.burstCount ?? 5;
    const windowHours = config.windowHours ?? 48;
    const windowMs = windowHours * 60 * 60 * 1000;

    const validExpenses = ctx.expenses
      .filter((e) => e.status !== "voided")
      .map((e) => ({
        ...e,
        time: new Date(e.createdAt || e.transactionDate).getTime(),
      }))
      .sort((a, b) => a.time - b.time);

    if (validExpenses.length < burstCount) {
      return [];
    }

    for (let i = 0; i <= validExpenses.length - burstCount; i++) {
      const startTime = validExpenses[i]!.time;
      const burstCluster = [validExpenses[i]!];

      for (let j = i + 1; j < validExpenses.length; j++) {
        if (validExpenses[j]!.time - startTime <= windowMs) {
          burstCluster.push(validExpenses[j]!);
        }
      }

      if (burstCluster.length >= burstCount) {
        const totalBurstAmount = burstCluster.reduce(
          (sum, e) => sum + parseFloat(e.amount || "0"),
          0,
        );
        return [
          {
            triggered: true,
            ruleCode: this.code,
            ruleName: this.name,
            severity: rule.severity,
            scoreContribution: rule.weight,
            detail: {
              burstCount: burstCluster.length,
              windowHours,
              totalAmount: totalBurstAmount.toFixed(2),
              expenseIds: burstCluster.map((e) => e.id),
            },
            explanation: `Abnormal submission burst: ${burstCluster.length} expenses totaling ₹${totalBurstAmount.toLocaleString("en-IN")} submitted within a ${windowHours}-hour window.`,
          },
        ];
      }
    }

    return [];
  }
}
