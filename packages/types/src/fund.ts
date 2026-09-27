import type { UUID, ISODateTime } from "./common.js";

export type FundAllocationStatus = "active" | "revised" | "cancelled";

export interface FundAllocation {
  id: UUID;
  projectId: UUID;
  programmeId: UUID | null;
  organisationId: UUID | null;
  allocatedAmount: string;
  fiscalYear: string;
  currency: string;
  sanctionedById: UUID | null;
  sanctionedAt: ISODateTime | null;
  status: FundAllocationStatus;
  scheme: string | null;
  description: string | null;
  notes: string | null;
  createdById: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type FundReleaseStatus = "released" | "reversed";

export interface FundRelease {
  id: UUID;
  allocationId: UUID;
  releasedAmount: string;
  releaseDate: ISODateTime;
  referenceNumber: string;
  releasedById: UUID | null;
  remarks: string | null;
  status: FundReleaseStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "voided";

export interface Expense {
  id: UUID;
  projectId: UUID;
  organisationId: UUID | null;
  allocationId: UUID | null;
  category: string;
  description: string;
  amount: string;
  transactionDate: ISODateTime;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNumber: string | null;
  invoiceDate: ISODateTime | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  status: ExpenseStatus;
  submittedById: UUID | null;
  submittedAt: ISODateTime | null;
  verifiedById: UUID | null;
  verifiedAt: ISODateTime | null;
  voidReason: string | null;
  voidedById: UUID | null;
  voidedAt: ISODateTime | null;
  createdById: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type DocumentVerificationStatus = "pending" | "verified" | "rejected" | "flagged";

export interface FinancialDocument {
  id: UUID;
  expenseId: UUID | null;
  projectId: UUID;
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  storageKey: string;
  verificationStatus: DocumentVerificationStatus;
  uploadedById: UUID | null;
  uploadedAt: ISODateTime;
  verifiedById: UUID | null;
  verifiedAt: ISODateTime | null;
  rejectionReason: string | null;
  duplicateOfId: UUID | null;
  createdAt: ISODateTime;
}

export type FinancialRiskSeverity = "low" | "medium" | "high" | "critical";

export interface FinancialRiskRule {
  id: UUID;
  code: string;
  name: string;
  category: string;
  description: string;
  conditionConfig: Record<string, unknown>;
  weight: number;
  severity: FinancialRiskSeverity;
  enabled: boolean;
  createdById: UUID | null;
  updatedById: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type FinancialRiskEventStatus = "open" | "acknowledged" | "resolved";

export interface FinancialRiskEvent {
  id: UUID;
  ruleId: UUID;
  projectId: UUID;
  organisationId: UUID | null;
  expenseId: UUID | null;
  documentId: UUID | null;
  allocationId: UUID | null;
  scoreContribution: number;
  detail: Record<string, unknown>;
  status: FinancialRiskEventStatus;
  resolvedById: UUID | null;
  resolvedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export type InspectionFlagStatus =
  | "open"
  | "under_review"
  | "assigned"
  | "inspection_in_progress"
  | "inspection_completed"
  | "resolved"
  | "dismissed";

export type InspectionFlagRiskLevel = "low" | "medium" | "high" | "critical";
export type InspectionFlagTriggerSource = "risk_engine" | "manual" | "complaint";

export interface EvidenceRef {
  type: string;
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface InspectionFlag {
  id: UUID;
  projectId: UUID;
  organisationId: UUID | null;
  allocationId: UUID | null;
  riskScore: number;
  riskLevel: InspectionFlagRiskLevel;
  triggerSource: InspectionFlagTriggerSource;
  explanation: string;
  evidenceRefs: EvidenceRef[];
  status: InspectionFlagStatus;
  assignedInspectorId: UUID | null;
  linkedInspectionId: UUID | null;
  reviewNotes: string | null;
  resolution: string | null;
  reviewerById: UUID | null;
  reviewedAt: ISODateTime | null;
  dismissedReason: string | null;
  dismissedById: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FundSummary {
  totalAllocated: string;
  totalReleased: string;
  totalExpenditure: string;
  pendingReleases: string;
  utilizationRate: number;
  activeAllocationsCount: number;
  expensesCount: number;
  flaggedExpensesCount: number;
}

export interface ProjectFundOverview {
  summary: FundSummary;
  allocations: FundAllocation[];
  recentExpenses: Expense[];
  recentRiskEvents: FinancialRiskEvent[];
  activeFlags: InspectionFlag[];
}

export interface AllocationListQuery {
  projectId?: UUID;
  organisationId?: UUID;
  fiscalYear?: string;
  status?: FundAllocationStatus;
  page?: number;
  pageSize?: number;
}

export interface ExpenseListQuery {
  projectId?: UUID;
  organisationId?: UUID;
  allocationId?: UUID;
  status?: ExpenseStatus;
  category?: string;
  vendorName?: string;
  startDate?: ISODateTime;
  endDate?: ISODateTime;
  page?: number;
  pageSize?: number;
}

export interface InspectionFlagListQuery {
  projectId?: UUID;
  organisationId?: UUID;
  riskLevel?: InspectionFlagRiskLevel;
  status?: InspectionFlagStatus;
  assignedInspectorId?: UUID;
  page?: number;
  pageSize?: number;
}
