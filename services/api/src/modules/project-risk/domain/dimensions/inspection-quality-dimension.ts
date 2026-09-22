import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";

export class InspectionQualityDimensionCalculator {
  readonly dimension = "inspection_quality" as const;

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const now = new Date();

    const openFindings = ctx.inspections.findings.filter(
      (f) => f.status !== "resolved" && f.status !== "closed",
    );
    let criticalFindingsCount = 0;
    let highFindingsCount = 0;
    let mediumFindingsCount = 0;
    let lowFindingsCount = 0;

    for (const f of openFindings) {
      if (f.severity === "critical") {
        criticalFindingsCount++;
        rawScore += 30;
      } else if (f.severity === "high") {
        highFindingsCount++;
        rawScore += 20;
      } else if (f.severity === "medium") {
        mediumFindingsCount++;
        rawScore += 10;
      } else {
        lowFindingsCount++;
        rawScore += 5;
      }
    }

    // Check overdue corrective actions
    let overdueActionsCount = 0;
    for (const ca of ctx.inspections.correctiveActions) {
      if (
        ca.status !== "approved" &&
        ca.status !== "submitted" &&
        ca.status !== "completed" &&
        ca.deadline &&
        new Date(ca.deadline) < now
      ) {
        overdueActionsCount++;
        rawScore += 25;
      }
    }

    // Inspection recency / stagnation
    const completedInspections = ctx.inspections.inspections.filter(
      (i) => i.status === "completed" || i.status === "submitted" || i.status === "closed",
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
      // Find most recent completion
      const sorted = [...completedInspections].sort((a, b) => {
        const timeA = new Date(a.submittedAt ?? a.createdAt).getTime();
        const timeB = new Date(b.submittedAt ?? b.createdAt).getTime();
        return timeB - timeA;
      });
      const first = sorted[0];
      if (first) {
        const lastDate = new Date(first.submittedAt ?? first.createdAt);
        daysSinceLastInspection = Math.floor(
          (now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000),
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
        `${openFindings.length} open finding(s) (${criticalFindingsCount} critical, ${highFindingsCount} high)`,
      );
    }
    if (overdueActionsCount > 0) {
      explanationParts.push(`${overdueActionsCount} overdue corrective action(s)`);
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
        overdueActionsCount,
        daysSinceLastInspection,
      },
    };
  }
}
