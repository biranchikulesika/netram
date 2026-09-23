import type {
  FundAllocation,
  FundRelease,
  Expense,
  FinancialDocument,
  FinancialRiskEvent,
  FinancialRiskSeverity,
  FinancialRiskRule,
} from "@netram/types";

export interface ProjectRiskMetadata {
  id: string;
  name: string;
  code: string;
  status: string;
  organisationId: string | null;
  districtId: string | null;
  totalInspections: number;
  completedInspections: number;
  openFindings: number;
  resolvedFindings: number;
}

export interface RiskEvaluationContext {
  projectId: string;
  organisationId: string | null;
  project: ProjectRiskMetadata;
  allocations: FundAllocation[];
  releases: FundRelease[];
  expenses: Expense[];
  documents: FinancialDocument[];
  existingEvents: FinancialRiskEvent[];
}

export interface RuleEvaluationResult {
  triggered: boolean;
  ruleCode: string;
  ruleName: string;
  severity: FinancialRiskSeverity;
  scoreContribution: number;
  detail: Record<string, unknown>;
  explanation: string;
  expenseId?: string | null;
  documentId?: string | null;
  allocationId?: string | null;
}

export interface RuleEvaluator {
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly defaultSeverity: FinancialRiskSeverity;
  readonly defaultWeight: number;

  evaluate(
    ctx: RiskEvaluationContext,
    rule: FinancialRiskRule,
  ): Promise<RuleEvaluationResult[]>;
}
