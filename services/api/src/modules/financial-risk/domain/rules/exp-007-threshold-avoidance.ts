import type { FinancialRiskRule } from "@netram/types";
import type { RiskEvaluationContext, RuleEvaluationResult, RuleEvaluator } from "../rule-evaluator.js";

export class Exp007ThresholdAvoidanceRule implements RuleEvaluator {
  readonly code = "EXP-007";
  readonly name = "Threshold Avoidance / Split Purchases";
  readonly category = "Vendor & Invoice Patterns";
  readonly defaultSeverity = "high" as const;
  readonly defaultWeight = 20;

  async evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]> {
    const config = rule.conditionConfig as {
      splitThreshold?: number;
      lowerBoundRatio?: number;
      windowDays?: number;
      minCount?: number;
    };
    const splitThreshold = config.splitThreshold ?? 250000;
    const lowerBoundRatio = config.lowerBoundRatio ?? 0.90;
    const windowDays = config.windowDays ?? 7;
    const minCount = config.minCount ?? 3;

    const lowerBound = splitThreshold * lowerBoundRatio;

    // Filter expenses that fall just below the threshold
    const candidateExpenses = ctx.expenses.filter((e) => {
      if (e.status === "voided" || e.status === "rejected") return false;
      const amt = parseFloat(e.amount || "0");
      return amt >= lowerBound && amt < splitThreshold;
    });

    if (candidateExpenses.length < minCount) {
      return [];
    }

    // Group by vendor
    const byVendor = new Map<string, typeof candidateExpenses>();
    for (const exp of candidateExpenses) {
      const vendorKey = exp.vendorName.trim().toUpperCase();
      const list = byVendor.get(vendorKey) ?? [];
      list.push(exp);
      byVendor.set(vendorKey, list);
    }

    const results: RuleEvaluationResult[] = [];
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    for (const [vendor, exps] of byVendor.entries()) {
      if (exps.length < minCount) continue;

      // Sort by transaction date
      exps.sort(
        (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
      );

      // Check sliding window
      for (let i = 0; i <= exps.length - minCount; i++) {
        const startTime = new Date(exps[i]!.transactionDate).getTime();
        const cluster = [exps[i]!];

        for (let j = i + 1; j < exps.length; j++) {
          const t = new Date(exps[j]!.transactionDate).getTime();
          if (t - startTime <= windowMs) {
            cluster.push(exps[j]!);
          }
        }

        if (cluster.length >= minCount) {
          const totalClusterAmount = cluster.reduce(
            (sum, e) => sum + parseFloat(e.amount || "0"),
            0,
          );
          results.push({
            triggered: true,
            ruleCode: this.code,
            ruleName: this.name,
            severity: rule.severity,
            scoreContribution: rule.weight,
            expenseId: cluster[0]!.id,
            detail: {
              vendorName: vendor,
              threshold: splitThreshold,
              windowDays,
              clusterCount: cluster.length,
              totalAmount: totalClusterAmount.toFixed(2),
              expenseIds: cluster.map((c) => c.id),
            },
            explanation: `${cluster.length} purchases totaling ₹${totalClusterAmount.toLocaleString("en-IN")} made to vendor "${vendor}" within ${windowDays} days, each just below the ₹${splitThreshold.toLocaleString("en-IN")} procurement ceiling.`,
          });
          break; // One trigger per vendor
        }
      }
    }

    return results;
  }
}
