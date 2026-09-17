import type { UUID } from "./common.js";

export interface SlaComplianceByJurisdiction {
  districtId: UUID;
  districtName: string;
  districtCode: string;
  totalActions: number;
  pendingActions: number;
  submittedActions: number;
  acceptedActions: number;
  overdueActions: number;
  slaComplianceRate: number; // percentage (0 - 100)
}

export interface DeficiencyRecurrence {
  category: string;
  totalOccurrences: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  unresolvedCount: number;
  resolvedCount: number;
}

export interface InspectionClosureVelocityByJurisdiction {
  districtId: UUID;
  districtName: string;
  totalInspections: number;
  closedInspections: number;
  averageClosureDays: number;
}

export interface InspectionClosureVelocity {
  totalInspections: number;
  closedInspections: number;
  inProgressInspections: number;
  underReviewInspections: number;
  averageClosureDays: number;
  velocityByJurisdiction: InspectionClosureVelocityByJurisdiction[];
}

export interface AuthorityAnalyticsSummary {
  totalProjects: number;
  activeProjects: number;
  totalInspections: number;
  closedInspections: number;
  averageClosureDays: number;
  totalCorrectiveActions: number;
  resolvedCorrectiveActions: number;
  overdueCorrectiveActions: number;
  overallSlaComplianceRate: number;
  totalComplaints: number;
  resolvedComplaints: number;
  complaintRedressalRate: number;
  totalFindings: number;
  criticalFindingsCount: number;
}

export interface AuthorityAnalyticsOverview {
  summary: AuthorityAnalyticsSummary;
  slaComplianceByJurisdiction: SlaComplianceByJurisdiction[];
  deficiencyRecurrence: DeficiencyRecurrence[];
  inspectionClosureVelocity: InspectionClosureVelocity;
  generatedAt: string;
}

export interface AnalyticsQuery {
  districtId?: UUID;
  fromDate?: string;
  toDate?: string;
}
