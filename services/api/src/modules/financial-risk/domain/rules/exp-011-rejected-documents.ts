import type { FinancialRiskRule } from "@netram/types";
import type {
  RiskEvaluationContext,
  RuleEvaluationResult,
  RuleEvaluator,
} from "../rule-evaluator.js";

export class Exp011RejectedDocumentsRule implements RuleEvaluator {
  readonly code = "EXP-011";
  readonly name = "High Ratio of Rejected Financial Documents";
  readonly category = "Evidence & Verification Quality";
  readonly defaultSeverity = "medium" as const;
  readonly defaultWeight = 15;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      minDocuments?: number;
      rejectionThresholdRatio?: number;
    };
    const minDocs = config.minDocuments ?? 5;
    const thresholdRatio = config.rejectionThresholdRatio ?? 0.3;

    if (ctx.documents.length < minDocs) {
      return [];
    }

    const rejectedDocs = ctx.documents.filter((d) => d.verificationStatus === "rejected");
    const rejectionRatio = rejectedDocs.length / ctx.documents.length;

    if (rejectionRatio >= thresholdRatio) {
      const pct = Math.round(rejectionRatio * 100);
      return [
        {
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          detail: {
            totalDocuments: ctx.documents.length,
            rejectedDocuments: rejectedDocs.length,
            rejectionPercentage: pct,
          },
          explanation: `${pct}% of uploaded financial vouchers (${rejectedDocs.length} of ${ctx.documents.length}) have failed official verification inspection.`,
        },
      ];
    }

    return [];
  }
}
