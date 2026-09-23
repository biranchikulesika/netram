import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";
import { DEFAULT_OBSERVATION_WINDOWS } from "../../config/risk-config.js";

export class AttendanceAnomalyDimensionCalculator {
  readonly dimension = "attendance_anomaly" as const;

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const anomalies = ctx.attendance.anomalies;

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let unreviewedCount = 0;

    for (const a of anomalies) {
      if (a.state !== "dismissed" && a.state !== "resolved") {
        unreviewedCount++;
        if (a.severity === "critical") {
          criticalCount++;
          rawScore += 25;
        } else if (a.severity === "high") {
          highCount++;
          rawScore += 15;
        } else if (a.severity === "medium") {
          mediumCount++;
          rawScore += 8;
        } else {
          lowCount++;
          rawScore += 3;
        }
      }
    }

    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    let dataQuality: DataQuality = "sufficient";
    if (anomalies.length === 0) {
      dataQuality = "partial";
    }

    const explanation =
      anomalies.length > 0
        ? `Attendance: ${anomalies.length} anomaly/anomalies in past ${DEFAULT_OBSERVATION_WINDOWS.attendanceDays}d (${criticalCount} critical, ${highCount} high, ${unreviewedCount} active) (normalized ${normalizedScore}/100)`
        : `Attendance: No attendance anomalies detected in past ${DEFAULT_OBSERVATION_WINDOWS.attendanceDays}d (normalized 0/100)`;

    return {
      dimension: this.dimension,
      rawScore,
      normalizedScore,
      weight,
      weightedContribution,
      dataQuality,
      explanation,
      signals: {
        windowDays: DEFAULT_OBSERVATION_WINDOWS.attendanceDays,
        totalAnomalies: anomalies.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        unreviewedCount,
      },
    };
  }
}
