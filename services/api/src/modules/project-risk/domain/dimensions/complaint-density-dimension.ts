import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";
import { DEFAULT_OBSERVATION_WINDOWS } from "../../config/risk-config.js";

/**
 * Complaint density dimension (§35 - complaints are oversight INPUTS).
 *
 * Real `ComplaintStatus` lifecycle: received → under_review → escalated →
 * resolved/closed. Scoring semantics:
 *   - escalated        → 40 (authority judged it serious enough to escalate;
 *                        §35 says a complaint is not confirmed misconduct, so
 *                        it still contributes evidence-weight, not a verdict)
 *   - received /
 *     under_review     → 25 (open, undecided)
 *   - resolved / closed → 0 (concluded outcome; the residual risk, if any,
 *                        lives in whatever the resolution produced)
 *
 * Volume still accumulates: a burst of open complaints signals a pattern even
 * though no single complaint is proof of anything (§35).
 */
export class ComplaintDensityDimensionCalculator {
  readonly dimension = "complaint_density" as const;

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const complaints = ctx.complaints.complaints;

    let openCount = 0; // received | under_review
    let escalatedCount = 0;
    let resolvedCount = 0; // resolved | closed
    let unknownStatusCount = 0;

    for (const c of complaints) {
      switch (c.status) {
        case "escalated":
          escalatedCount++;
          rawScore += 40;
          break;
        case "received":
        case "under_review":
          openCount++;
          rawScore += 25;
          break;
        case "resolved":
        case "closed":
          resolvedCount++;
          break;
        default:
          // Unknown status must not silently score as resolved.
          unknownStatusCount++;
          rawScore += 25;
          break;
      }
    }

    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    // Zero complaints is strong evidence of LOW complaint pressure only when
    // the window is actually populated (a project with no grievance channel
    // usage looks identical to one nobody has complained about). The signal
    // exposes the count; interpretation stays with the reviewer.
    const dataQuality: DataQuality = "sufficient";

    const explanation =
      complaints.length > 0
        ? `Complaints: ${complaints.length} complaint(s) in past ${DEFAULT_OBSERVATION_WINDOWS.complaintDays}d (${openCount} open, ${escalatedCount} escalated, ${resolvedCount} resolved/closed) (normalized ${normalizedScore}/100)`
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
        openComplaintsCount: openCount,
        escalatedCount,
        resolvedComplaintsCount: resolvedCount,
        unknownStatusCount,
      },
    };
  }
}
