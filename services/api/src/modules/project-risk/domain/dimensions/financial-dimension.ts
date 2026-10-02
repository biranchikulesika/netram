import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";

export class FinancialDimensionCalculator {
  readonly dimension = "financial" as const;

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    const rawScore = ctx.financial.totalScore;
    const maxRawScore =
      ctx.financial.maxPossibleRawScore > 0 ? ctx.financial.maxPossibleRawScore : 220;

    // Normalize raw score (0 to maxRawScore) to 0-100
    const normalizedScore = Math.min(100, Math.round((rawScore / maxRawScore) * 100));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    let dataQuality: DataQuality = "sufficient";
    if (ctx.financial.allocationsCount === 0 && ctx.financial.expensesCount === 0) {
      dataQuality = "no_data";
    } else if (ctx.financial.expensesCount === 0) {
      dataQuality = "partial";
    }

    const ruleCount = ctx.financial.triggeredRules.length;
    const ruleCodes = ctx.financial.triggeredRules.map((r) => r.ruleCode).join(", ");
    const explanation =
      ruleCount > 0
        ? `Financial: ${ruleCount} discrepancies triggered (${ruleCodes}), raw score ${rawScore}/${maxRawScore} (normalized ${normalizedScore}/100)`
        : `Financial: No financial discrepancies detected (normalized 0/100)`;

    return {
      dimension: this.dimension,
      rawScore,
      normalizedScore,
      weight,
      weightedContribution,
      dataQuality,
      explanation,
      signals: {
        rawScore,
        maxPossibleRawScore: maxRawScore,
        ruleCount,
        triggeredRules: ctx.financial.triggeredRules,
        allocationsCount: ctx.financial.allocationsCount,
        expensesCount: ctx.financial.expensesCount,
        flagId: ctx.financial.flagId,
        riskLevel: ctx.financial.riskLevel,
      },
    };
  }
}
