import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";
import {
  DEFAULT_OBSERVATION_WINDOWS,
  RESOLVED_OUTCOME_ATTENUATION,
} from "../../config/risk-config.js";

/**
 * Attendance anomaly dimension.
 *
 * Compares against the REAL `AttendanceAnomalyState` and
 * `AttendanceAnomalySeverity` enums from @netram/types:
 *   states   = NEW | REVIEWED | DISMISSED | FALSE_POSITIVE | INVESTIGATING | ACTIONED
 *   severity = LOW | MEDIUM | HIGH | CRITICAL
 *
 * Risk semantics (§26, §36):
 *   - DISMISSED / FALSE_POSITIVE are human-declared non-issues → contribute 0.
 *   - ACTIONED (remediated) keeps a small residual weight (the signal was
 *     real; current risk is mostly retired).
 *   - Everything else (NEW, REVIEWED, INVESTIGATING) contributes full weight -
 *     review so far has NOT contradicted the detector.
 */
export class AttendanceAnomalyDimensionCalculator {
  readonly dimension = "attendance_anomaly" as const;

  /** States a human has declared NOT real (or withdrawn): no risk contribution. */
  private static readonly EXONERATED_STATES = new Set(["DISMISSED", "FALSE_POSITIVE"]);

  /** States where a human concluded the signal was real and remediated it. */
  private static readonly RESOLVED_STATES = new Set(["ACTIONED"]);

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const anomalies = ctx.attendance.anomalies;

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let activeCount = 0; // NEW | REVIEWED | INVESTIGATING
    let actionedCount = 0;
    let exoneratedCount = 0; // DISMISSED | FALSE_POSITIVE
    let unknownStateCount = 0;

    for (const a of anomalies) {
      if (AttendanceAnomalyDimensionCalculator.EXONERATED_STATES.has(a.state)) {
        exoneratedCount++;
        continue;
      }

      if (AttendanceAnomalyDimensionCalculator.RESOLVED_STATES.has(a.state)) {
        actionedCount++;
        rawScore += 25 * RESOLVED_OUTCOME_ATTENUATION;
        continue;
      }

      // Active states: severity points at full weight, case-correct.
      switch (a.severity) {
        case "CRITICAL":
          criticalCount++;
          rawScore += 25;
          break;
        case "HIGH":
          highCount++;
          rawScore += 15;
          break;
        case "MEDIUM":
          mediumCount++;
          rawScore += 8;
          break;
        case "LOW":
          lowCount++;
          rawScore += 3;
          break;
        default:
          // Unknown severity string must not silently score as lowest tier.
          unknownStateCount++;
          rawScore += 8; // conservative default = MEDIUM weight
          break;
      }
      activeCount++;
    }

    const normalizedScore = Math.min(100, Math.max(0, Math.round(rawScore)));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    let dataQuality: DataQuality = "sufficient";
    if (anomalies.length === 0) {
      dataQuality = "partial";
    }

    const explanation =
      anomalies.length > 0
        ? `Attendance: ${activeCount} active, ${actionedCount} actioned, ${exoneratedCount} dismissed/false-positive of ${anomalies.length} anomaly/anomalies in past ${DEFAULT_OBSERVATION_WINDOWS.attendanceDays}d (${criticalCount} critical, ${highCount} high) (normalized ${normalizedScore}/100)`
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
        activeCount,
        actionedCount,
        exoneratedCount,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        unknownSeverityCount: unknownStateCount,
      },
    };
  }
}
