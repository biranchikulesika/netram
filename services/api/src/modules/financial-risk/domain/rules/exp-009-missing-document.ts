import type { FinancialRiskRule } from "@netram/types";
import type {
  RiskEvaluationContext,
  RuleEvaluationResult,
  RuleEvaluator,
} from "../rule-evaluator.js";

export class Exp009MissingDocumentRule implements RuleEvaluator {
  readonly code = "EXP-009";
  readonly name = "Missing Supporting Document on High-Value Expense";
  readonly category = "Evidence & Verification Quality";
  readonly defaultSeverity = "high" as const;
  readonly defaultWeight = 20;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      highValueThreshold?: number;
    };
    const highValueThreshold = config.highValueThreshold ?? 50000;

    const expenseDocCount = new Map<string, number>();
    for (const doc of ctx.documents) {
      if (doc.expenseId) {
        const c = expenseDocCount.get(doc.expenseId) ?? 0;
        expenseDocCount.set(doc.expenseId, c + 1);
      }
    }

    const results: RuleEvaluationResult[] = [];

    for (const exp of ctx.expenses) {
      if (exp.status === "voided" || exp.status === "draft") continue;
      const amt = parseFloat(exp.amount || "0");
      if (amt >= highValueThreshold) {
        const docCount = expenseDocCount.get(exp.id) ?? 0;
        if (docCount === 0) {
          results.push({
            triggered: true,
            ruleCode: this.code,
            ruleName: this.name,
            severity: rule.severity,
            scoreContribution: rule.weight,
            expenseId: exp.id,
            detail: {
              expenseId: exp.id,
              amount: exp.amount,
              threshold: highValueThreshold,
              vendorName: exp.vendorName,
            },
            explanation: `High-value expenditure of ₹${amt.toLocaleString("en-IN")} submitted without any attached invoice, receipt, or supporting proof.`,
          });
        }
      }
    }

    return results;
  }
}
