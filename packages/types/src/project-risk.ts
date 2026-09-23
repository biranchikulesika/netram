import type { UUID, ISODateTime } from "./common.js";

export type CompositeRiskLevel = "low" | "medium" | "high" | "critical";

export type DataQuality = "sufficient" | "partial" | "sparse" | "no_data";

export interface DimensionResult {
  dimension: "financial" | "inspection_quality" | "attendance_anomaly" | "complaint_density" | "ai_anomaly";
  rawScore: number;
  normalizedScore: number; // 0 to 100 normalized within the dimension
  weight: number;          // e.g. 40, 25, 20, 10, 5
  weightedContribution: number; // (normalizedScore * weight) / 100
  dataQuality: DataQuality;
  explanation: string;
  signals: Record<string, unknown>;
}

export interface RiskContributor {
  dimension: string;
  contribution: number;
  percentage: number;
  explanation: string;
}

export interface CompositeRiskScore {
  totalScore: number; // 0 to 100
  riskLevel: CompositeRiskLevel;
  dimensions: {
    financial: DimensionResult;
    inspection_quality: DimensionResult;
    attendance_anomaly: DimensionResult;
    complaint_density: DimensionResult;
    ai_anomaly: DimensionResult;
  };
  topContributors: RiskContributor[];
  actionableDirectives?: string[];
  compoundBonus?: number;
  calculatedAt: ISODateTime;
  scoringVersion: string;
}

export interface ProjectRiskSnapshot {
  id: UUID;
  projectId: UUID;
  calculatedAt: ISODateTime;
  scoringVersion: string;
  totalScore: number;
  riskLevel: CompositeRiskLevel;
  financialScore: number;
  inspectionQualityScore: number;
  attendanceAnomalyScore: number;
  complaintDensityScore: number;
  aiAnomalyScore: number;
  financialSignals: Record<string, unknown>;
  inspectionQualitySignals: Record<string, unknown>;
  attendanceAnomalySignals: Record<string, unknown>;
  complaintDensitySignals: Record<string, unknown>;
  aiAnomalySignals: Record<string, unknown>;
  topContributors: RiskContributor[];
  actionableDirectives?: string[];
  compoundBonus?: number;
  explanation: string;
  inspectionFlagId: UUID | null;
  scheduledInspectionId: UUID | null;
  createdAt: ISODateTime;
}

export interface ProjectRankEntry {
  rank: number;
  projectId: UUID;
  projectCode: string;
  projectName: string;
  districtId: UUID | null;
  districtName: string | null;
  programmeId: UUID | null;
  programmeName: string | null;
  organisationId: UUID | null;
  organisationName: string | null;
  totalScore: number;
  riskLevel: CompositeRiskLevel;
  topContributors: RiskContributor[];
  lastCalculatedAt: ISODateTime;
  openInspectionCount: number;
  hasOpenFlag: boolean;
  scoringVersion: string;
}

export interface ProjectRiskRankingQuery {
  districtId?: UUID;
  programmeId?: UUID;
  organisationId?: UUID;
  riskLevel?: CompositeRiskLevel;
  minScore?: number;
  maxScore?: number;
  page?: number;
  pageSize?: number;
}

export interface ProjectRiskSnapshotQuery {
  projectId: UUID;
  startDate?: ISODateTime;
  endDate?: ISODateTime;
  limit?: number;
}

export interface SchedulingDecision {
  projectId: UUID;
  shouldSchedule: boolean;
  reason: string;
  actionTaken: "scheduled" | "cooldown_skipped" | "existing_open_inspection_skipped" | "threshold_not_met" | "flagged_only";
  inspectionId?: UUID;
  inspectionFlagId?: UUID;
}
