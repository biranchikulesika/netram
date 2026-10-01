import type { FinancialRiskRule } from "@netram/types";
import type {
  RiskEvaluationContext,
  RuleEvaluationResult,
  RuleEvaluator,
} from "../rule-evaluator.js";

export class Exp013PhysicalFinancialDivergenceRule implements RuleEvaluator {
  readonly code = "EXP-013";
  readonly name = "Physical Progress vs Financial Progress Divergence";
  readonly category = "Velocity & Operational Correlation";
  readonly defaultSeverity = "high" as const;
  readonly defaultWeight = 25;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      financialThresholdPct?: number;
      maxPhysicalProgressPct?: number;
    };
    const financialThresholdPct = config.financialThresholdPct ?? 80;
    const maxPhysicalProgressPct = config.maxPhysicalProgressPct ?? 40;

    const totalReleased = ctx.releases
      .filter((r) => r.status === "released")
      .reduce((sum, r) => sum + parseFloat(r.releasedAmount || "0"), 0);

    if (totalReleased <= 0) return [];

    const totalExpense = ctx.expenses
      .filter((e) => e.status !== "voided" && e.status !== "rejected")
      .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    const financialUtilizationPct = (totalExpense / totalReleased) * 100;

    if (financialUtilizationPct < financialThresholdPct) {
      return [];
    }

    // Compute physical progress proxy based on completed inspections
    // If there are inspections, ratio of completed / total
    const { totalInspections, completedInspections, openFindings, resolvedFindings } = ctx.project;

    let physicalProgressPct = 0;
    if (totalInspections > 0) {
      physicalProgressPct = (completedInspections / totalInspections) * 100;
    } else if (openFindings + resolvedFindings > 0) {
      physicalProgressPct = (resolvedFindings / (openFindings + resolvedFindings)) * 100;
    } else {
      // No inspections recorded yet for an active project with high financial burn!
      physicalProgressPct = 0;
    }

    if (physicalProgressPct < maxPhysicalProgressPct) {
      return [
        {
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          detail: {
            financialUtilizationPct: Math.round(financialUtilizationPct),
            physicalProgressPct: Math.round(physicalProgressPct),
            totalReleased: totalReleased.toFixed(2),
            totalExpense: totalExpense.toFixed(2),
            totalInspections,
            completedInspections,
            openFindings,
          },
          explanation: `Financial utilization is at ${Math.round(financialUtilizationPct)}% (₹${totalExpense.toLocaleString("en-IN")} spent of ₹${totalReleased.toLocaleString("en-IN")} released) while verified physical progress proxy is only ${Math.round(physicalProgressPct)}% (${completedInspections}/${totalInspections} inspections completed).`,
        },
      ];
    }

    return [];
  }
}
