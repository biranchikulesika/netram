import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

export class Exp005DuplicateInvoiceRule implements RuleEvaluator {
  readonly code = "EXP-005";
  readonly name = "Duplicate Invoice Number";
  readonly category = "Vendor & Invoice Patterns";
  readonly defaultSeverity = "critical" as const;
  readonly defaultWeight = 30;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const invoiceMap = new Map<string, string[]>(); // invoice -> expenseIds

    for (const exp of ctx.expenses) {
      if (exp.status === "voided") continue;
      if (!exp.invoiceNumber || !exp.invoiceNumber.trim()) continue;

      const normalized = exp.invoiceNumber.trim().toUpperCase();
      const existing = invoiceMap.get(normalized) ?? [];
      existing.push(exp.id);
      invoiceMap.set(normalized, existing);
    }

    const results: RuleEvaluationResult[] = [];

    for (const [invoiceNum, expenseIds] of invoiceMap.entries()) {
      if (expenseIds.length > 1) {
        results.push({
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          expenseId: expenseIds[0],
          detail: {
            invoiceNumber: invoiceNum,
            duplicateExpenseIds: expenseIds,
            occurrences: expenseIds.length,
          },
          explanation: `Invoice number "${invoiceNum}" appears on ${expenseIds.length} separate expense claims under this project.`,
        });
      }
    }

    return results;
  }
}
