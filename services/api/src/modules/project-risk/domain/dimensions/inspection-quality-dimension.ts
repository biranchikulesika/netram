import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";
import { RESOLVED_OUTCOME_ATTENUATION } from "../../config/risk-config.js";

/**
 * Inspection quality dimension.
 *
 * Consumes the REAL lifecycle enums from @netram/types:
 *   FindingStatus          = new | confirmed | dismissed | action_required
 *   FindingSeverity        = critical | high | medium | low
 *   CorrectiveActionStatus = pending | submitted | under_review | accepted |
 *                            rejected | overdue | escalated
 *   InspectionStatus       = assigned | scheduled | in_progress |
 *                            evidence_collection | submitted | under_review |
 *                            findings | corrective_actions | verification |
 *                            closed
 *
 * Risk semantics:
 *   - dismissed findings contribute 0 (authority review rejected them - §32);
 *     they are still reported in signals for transparency.
 *   - Corrective actions with a concluded outcome (accepted / rejected) keep a
 *     small residual weight via RESOLVED_OUTCOME_ATTENUATION: the finding was
 *     real, but the current risk is mostly retired once remediation is
 *     accepted. `rejected` (ATR rejected → work not done) counts as overdue
 *     at full weight because the underlying deficiency is unremediated.
 *   - Recency uses the latest lifecycle timestamp (submittedAt ?? updatedAt??
 *     startedAt ?? createdAt), so post-submission stages no longer read as
 *     "never inspected".
 */
export class InspectionQualityDimensionCalculator {
  readonly dimension = "inspection_quality" as const;

  private static readonly CLOSED_ACTION_OUTCOMES = new Set(["accepted", "rejected"]);

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const now = new Date();

    // ---------- Open findings (case-correct FindingStatus) ----------
    const openFindings = ctx.inspections.findings.filter(
      (f) => f.status !== "dismissed" && f.status !== "closed",
    );
    let criticalFindingsCount = 0;
    let highFindingsCount = 0;
    let mediumFindingsCount = 0;
    let lowFindingsCount = 0;
    let unknownSeverityFindingsCount = 0;

    for (const f of openFindings) {
      switch (f.severity) {
        case "critical":
          criticalFindingsCount++;
          rawScore += 30;
          break;
        case "high":
          highFindingsCount++;
          rawScore += 20;
          break;
        case "medium":
          mediumFindingsCount++;
          rawScore += 10;
          break;
        case "low":
          lowFindingsCount++;
          rawScore += 5;
          break;
        default:
          // Unknown severity must not silently score as lowest tier.
          unknownSeverityFindingsCount++;
          rawScore += 10; // conservative default = MEDIUM weight
          break;
      }
    }

    // ---------- Corrective actions (case-correct CorrectiveActionStatus) ----------
    let overdueActionsCount = 0;
    let remediatedActionsCount = 0;
    let rejectedActionsCount = 0;
    let openActionsCount = 0;

    for (const ca of ctx.inspections.correctiveActions) {
      const isPastDeadline =
        ca.deadline !== null && new Date(ca.deadline) < now;

      if (ca.status === "accepted") {
        // Remediation accepted by authority: mostly retired risk.
        remediatedActionsCount++;
        rawScore += 25 * RESOLVED_OUTCOME_ATTENUATION;
        continue;
      }

      if (ca.status === "rejected") {
        // ATR rejected → the deficiency remains unremediated. Count as
        // overdue at full weight whether or not the deadline has passed.
        rejectedActionsCount++;
        if (isPastDeadline || ca.deadline === null) {
          overdueActionsCount++;
          rawScore += 25;
        } else {
          rawScore += 15; // rejected but still inside its (re-)deadline window
        }
        continue;
      }

      if (ca.status === "overdue" || (isPastDeadline && ca.status !== "submitted")) {
        overdueActionsCount++;
        rawScore += 25;
        continue;
      }

      // pending | submitted | under_review | escalated: open obligation.
      openActionsCount++;
      rawScore += 10;
    }

    // ---------- Recency / stagnation ----------
    // Recency counts any inspection that has actually STARTED (everything
    // beyond assignment/scheduling), so post-submission pipeline stages
    // (under_review → … → closed) never read as "never inspected".
    const NOT_YET_EXECUTED = new Set(["assigned", "scheduled"]);
    const completedInspections = ctx.inspections.inspections.filter(
      (i) => !NOT_YET_EXECUTED.has(i.status),
    );

    let daysSinceLastInspection: number | null = null;
    if (completedInspections.length === 0) {
      const projectAgeDays = Math.floor(
        (now.getTime() - new Date(ctx.project.createdAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (projectAgeDays > 60) {
        rawScore += 30;
      } else if (projectAgeDays > 30) {
        rawScore += 15;
      }
    } else {
      const sorted = [...completedInspections].sort((a, b) => {
        const timeA = new Date(
          InspectionQualityDimensionCalculator.latestTimestamp(a),
        ).getTime();
        const timeB = new Date(
          InspectionQualityDimensionCalculator.latestTimestamp(b),
        ).getTime();
        return timeB - timeA;
      });
      const first = sorted[0];
      if (first) {
        const lastDate = new Date(
          InspectionQualityDimensionCalculator.latestTimestamp(first),
        );
        // Guard against malformed future timestamps producing negative ages.
        daysSinceLastInspection = Math.max(
          0,
          Math.floor((now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000)),
        );

        if (daysSinceLastInspection > 180) {
          rawScore += 25;
        } else if (daysSinceLastInspection > 90) {
          rawScore += 15;
        }
      }
    }

    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    let dataQuality: DataQuality = "sufficient";
    if (ctx.inspections.inspections.length === 0) {
      dataQuality = "sparse";
    }

    const explanationParts: string[] = [];
    if (openFindings.length > 0) {
      explanationParts.push(
        `${openFindings.length} open finding(s) (${criticalFindingsCount} critical, ${highFindingsCount} high, ${unknownSeverityFindingsCount} unknown severity)`,
      );
    }
    if (overdueActionsCount > 0) {
      explanationParts.push(`${overdueActionsCount} overdue corrective action(s)`);
    }
    if (remediatedActionsCount > 0 || rejectedActionsCount > 0) {
      explanationParts.push(
        `${remediatedActionsCount} accepted / ${rejectedActionsCount} rejected corrective action(s)`,
      );
    }
    if (completedInspections.length === 0) {
      explanationParts.push("No prior inspections conducted");
    } else if (daysSinceLastInspection !== null && daysSinceLastInspection > 90) {
      explanationParts.push(`Last inspected ${daysSinceLastInspection} days ago`);
    }

    const explanation =
      explanationParts.length > 0
        ? `Inspection Quality: ${explanationParts.join("; ")} (normalized ${normalizedScore}/100)`
        : `Inspection Quality: Satisfactory inspection history and findings status (normalized 0/100)`;

    return {
      dimension: this.dimension,
      rawScore,
      normalizedScore,
      weight,
      weightedContribution,
      dataQuality,
      explanation,
      signals: {
        totalInspections: ctx.inspections.inspections.length,
        completedInspections: completedInspections.length,
        openFindingsCount: openFindings.length,
        criticalFindingsCount,
        highFindingsCount,
        mediumFindingsCount,
        lowFindingsCount,
        unknownSeverityFindingsCount,
        overdueActionsCount,
        remediatedActionsCount,
        rejectedActionsCount,
        openActionsCount,
        daysSinceLastInspection,
      },
    };
  }

  /**
   * Latest known lifecycle timestamp of an inspection. Inspections deep in
   * the post-submission pipeline (under_review → … → closed) may not carry a
   * fresh submittedAt on every row; fall back through the lifecycle so
   * recency reflects the last real activity instead of the creation date.
   */
  private static latestTimestamp(i: {
    submittedAt?: string | null;
    startedAt?: string | null;
    createdAt: string;
  }): string {
    return i.submittedAt ?? i.startedAt ?? i.createdAt;
  }
}
