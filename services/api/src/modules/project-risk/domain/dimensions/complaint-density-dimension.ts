import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";
import { DEFAULT_OBSERVATION_WINDOWS } from "../../config/risk-config.js";

export class ComplaintDensityDimensionCalculator {
  readonly dimension = "complaint_density" as const;

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const complaints = ctx.complaints.complaints;

    let openComplaintsCount = 0;
    let resolvedComplaintsCount = 0;

    for (const c of complaints) {
      if (c.status !== "resolved" && c.status !== "rejected" && c.status !== "closed") {
        openComplaintsCount++;
        rawScore += 25;
      } else {
        resolvedComplaintsCount++;
        rawScore += 10;
      }
    }

    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    const dataQuality: DataQuality = "sufficient";

    const explanation =
      complaints.length > 0
        ? `Complaints: ${complaints.length} complaint(s) in past ${DEFAULT_OBSERVATION_WINDOWS.complaintDays}d (${openComplaintsCount} open, ${resolvedComplaintsCount} resolved) (normalized ${normalizedScore}/100)`
        : `Complaints: Zero citizen complaints registered in past ${DEFAULT_OBSERVATION_WINDOWS.complaintDays}d (normalized 0/100)`;

    return {
      dimension: this.dimension,
      rawScore,
      normalizedScore,
      weight,
      weightedContribution,
      dataQuality,
      explanation,
      signals: {
        windowDays: DEFAULT_OBSERVATION_WINDOWS.complaintDays,
        totalComplaints: complaints.length,
        openComplaintsCount,
        resolvedComplaintsCount,
      },
    };
  }
}
