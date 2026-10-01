import type { FinancialRiskRule } from "@netram/types";
import type {
  RiskEvaluationContext,
  RuleEvaluationResult,
  RuleEvaluator,
} from "../rule-evaluator.js";

export class Exp003FrontLoadingRule implements RuleEvaluator {
  readonly code = "EXP-003";
  readonly name = "Rapid Fund Depletion (Front-loading)";
  readonly category = "Budget & Allocation";
  readonly defaultSeverity = "medium" as const;
  readonly defaultWeight = 15;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      thresholdPct?: number;
      daysThreshold?: number;
    };
    const thresholdPct = config.thresholdPct ?? 70;
    const daysThreshold = config.daysThreshold ?? 30;

    const results: RuleEvaluationResult[] = [];

    for (const release of ctx.releases.filter((r) => r.status === "released")) {
      const releaseAmount = parseFloat(release.releasedAmount || "0");
      if (releaseAmount <= 0) continue;

      const releaseTime = new Date(release.releaseDate).getTime();
      const cutoffTime = releaseTime + daysThreshold * 24 * 60 * 60 * 1000;

      const spentWithinWindow = ctx.expenses
        .filter((e) => {
          if (e.status === "voided" || e.status === "rejected") return false;
          const txTime = new Date(e.transactionDate).getTime();
          return txTime >= releaseTime && txTime <= cutoffTime;
        })
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

      const pctSpent = (spentWithinWindow / releaseAmount) * 100;
      if (pctSpent >= thresholdPct) {
        results.push({
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          allocationId: release.allocationId,
          detail: {
            releaseId: release.id,
            releaseReference: release.referenceNumber,
            releasedAmount: releaseAmount.toFixed(2),
            spentWithinWindow: spentWithinWindow.toFixed(2),
            percentageSpent: Math.round(pctSpent),
            daysWindow: daysThreshold,
          },
          explanation: `${Math.round(pctSpent)}% of fund release (${release.referenceNumber}: ₹${releaseAmount.toLocaleString("en-IN")}) was expended within ${daysThreshold} days of disbursement.`,
        });
      }
    }

    return results;
  }
}
