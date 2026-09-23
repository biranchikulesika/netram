import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

// Benford's Law theoretical probabilities for leading digits 1..9
const BENFORD_PROBABILITIES: Record<number, number> = {
  1: Math.log10(1 + 1 / 1), // ~0.3010
  2: Math.log10(1 + 1 / 2), // ~0.1761
  3: Math.log10(1 + 1 / 3), // ~0.1249
  4: Math.log10(1 + 1 / 4), // ~0.0792
  5: Math.log10(1 + 1 / 5), // ~0.0792
  6: Math.log10(1 + 1 / 6), // ~0.0669
  7: Math.log10(1 + 1 / 7), // ~0.0580
  8: Math.log10(1 + 1 / 8), // ~0.0512
  9: Math.log10(1 + 1 / 9), // ~0.0458
};

// Chi-square critical value at df=8, p=0.05 is 15.507
const CHI_SQUARE_CRITICAL_8DF = 15.51;

export class Exp006BenfordAnomalyRule implements RuleEvaluator {
  readonly code = "EXP-006";
  readonly name = "Benford's Law First-Digit Distribution Anomaly";
  readonly category = "Vendor & Invoice Patterns";
  readonly defaultSeverity = "medium" as const;
  readonly defaultWeight = 15;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      minExpenses?: number;
      criticalChiSquare?: number;
    };
    const minExpenses = config.minExpenses ?? 30;
    const criticalChiSquare = config.criticalChiSquare ?? CHI_SQUARE_CRITICAL_8DF;

    const validExpenses = ctx.expenses.filter((e) => {
      if (e.status === "voided" || e.status === "rejected") return false;
      const amt = parseFloat(e.amount || "0");
      return amt > 0;
    });

    if (validExpenses.length < minExpenses) {
      return [];
    }

    // Tally observed first digits
    const observedCounts: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
    };

    let totalDigits = 0;
    for (const exp of validExpenses) {
      const match = exp.amount.trim().match(/^[0]*([1-9])/);
      if (match && match[1]) {
        const digit = parseInt(match[1], 10);
        if (digit >= 1 && digit <= 9) {
          observedCounts[digit] = (observedCounts[digit] ?? 0) + 1;
          totalDigits++;
        }
      }
    }

    if (totalDigits < minExpenses) return [];

    let chiSquare = 0;
    const distributionSummary: Record<string, { observed: number; expected: number }> = {};

    for (let d = 1; d <= 9; d++) {
      const expectedCount = totalDigits * BENFORD_PROBABILITIES[d]!;
      const observedCount = observedCounts[d]!;
      const diff = observedCount - expectedCount;
      chiSquare += (diff * diff) / expectedCount;

      distributionSummary[`digit_${d}`] = {
        observed: observedCount,
        expected: Math.round(expectedCount * 10) / 10,
      };
    }

    if (chiSquare > criticalChiSquare) {
      return [
        {
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          detail: {
            sampleSize: totalDigits,
            chiSquareStatistic: Math.round(chiSquare * 100) / 100,
            criticalThreshold: criticalChiSquare,
            distribution: distributionSummary,
          },
          explanation: `Expense amount leading-digit distribution statistically deviates from Benford's Law (χ² = ${chiSquare.toFixed(2)} > ${criticalChiSquare}, n = ${totalDigits}), indicating potential artificial amount fabrication.`,
        },
      ];
    }

    return [];
  }
}
