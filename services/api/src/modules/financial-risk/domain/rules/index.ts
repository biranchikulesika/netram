import type { RuleEvaluator } from "../rule-evaluator.js";
import { Exp001OverAllocationRule } from "./exp-001-over-allocation.js";
import { Exp002OverReleaseRule } from "./exp-002-over-release.js";
import { Exp003FrontLoadingRule } from "./exp-003-front-loading.js";
import { Exp004UnallocatedExpenseRule } from "./exp-004-unallocated-expense.js";
import { Exp005DuplicateInvoiceRule } from "./exp-005-duplicate-invoice.js";
import { Exp006BenfordAnomalyRule } from "./exp-006-benford-anomaly.js";
import { Exp007ThresholdAvoidanceRule } from "./exp-007-threshold-avoidance.js";
import { Exp008RoundNumberRule } from "./exp-008-round-number.js";
import { Exp009MissingDocumentRule } from "./exp-009-missing-document.js";
import { Exp010DuplicateHashRule } from "./exp-010-duplicate-hash.js";
import { Exp011RejectedDocumentsRule } from "./exp-011-rejected-documents.js";
import { Exp012VelocityBurstRule } from "./exp-012-velocity-burst.js";
import { Exp013PhysicalFinancialDivergenceRule } from "./exp-013-physical-financial-divergence.js";

export * from "./exp-001-over-allocation.js";
export * from "./exp-002-over-release.js";
export * from "./exp-003-front-loading.js";
export * from "./exp-004-unallocated-expense.js";
export * from "./exp-005-duplicate-invoice.js";
export * from "./exp-006-benford-anomaly.js";
export * from "./exp-007-threshold-avoidance.js";
export * from "./exp-008-round-number.js";
export * from "./exp-009-missing-document.js";
export * from "./exp-010-duplicate-hash.js";
export * from "./exp-011-rejected-documents.js";
export * from "./exp-012-velocity-burst.js";
export * from "./exp-013-physical-financial-divergence.js";

export function createDefaultRuleEvaluators(): Map<string, RuleEvaluator> {
  const evaluators: RuleEvaluator[] = [
    new Exp001OverAllocationRule(),
    new Exp002OverReleaseRule(),
    new Exp003FrontLoadingRule(),
    new Exp004UnallocatedExpenseRule(),
    new Exp005DuplicateInvoiceRule(),
    new Exp006BenfordAnomalyRule(),
    new Exp007ThresholdAvoidanceRule(),
    new Exp008RoundNumberRule(),
    new Exp009MissingDocumentRule(),
    new Exp010DuplicateHashRule(),
    new Exp011RejectedDocumentsRule(),
    new Exp012VelocityBurstRule(),
    new Exp013PhysicalFinancialDivergenceRule(),
  ];

  const map = new Map<string, RuleEvaluator>();
  for (const evaluator of evaluators) {
    map.set(evaluator.code, evaluator);
  }
  return map;
}
