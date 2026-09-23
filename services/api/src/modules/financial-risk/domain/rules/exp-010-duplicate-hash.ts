import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

export class Exp010DuplicateHashRule implements RuleEvaluator {
  readonly code = "EXP-010";
  readonly name = "Duplicate Document Content Hash (Byte Equality)";
  readonly category = "Evidence & Verification Quality";
  readonly defaultSeverity = "critical" as const;
  readonly defaultWeight = 30;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const hashMap = new Map<string, typeof ctx.documents>();

    for (const doc of ctx.documents) {
      if (!doc.sha256Hash) continue;
      const list = hashMap.get(doc.sha256Hash) ?? [];
      list.push(doc);
      hashMap.set(doc.sha256Hash, list);
    }

    const results: RuleEvaluationResult[] = [];

    for (const [hash, docs] of hashMap.entries()) {
      if (docs.length > 1) {
        // Collect distinct expense IDs if applicable
        const expenseIds = Array.from(
          new Set(docs.map((d) => d.expenseId).filter(Boolean)),
        );

        results.push({
          triggered: true,
          ruleCode: this.code,
          ruleName: this.name,
          severity: rule.severity,
          scoreContribution: rule.weight,
          documentId: docs[0]!.id,
          expenseId: docs[0]!.expenseId,
          detail: {
            sha256Hash: hash,
            documentIds: docs.map((d) => d.id),
            fileNames: docs.map((d) => d.fileName),
            associatedExpenseIds: expenseIds,
            occurrences: docs.length,
          },
          explanation: `Identical file content (SHA-256: ${hash.slice(0, 16)}...) was uploaded ${docs.length} times across financial records ("${docs.map((d) => d.fileName).join('", "')}").`,
        });
      }
    }

    return results;
  }
}
