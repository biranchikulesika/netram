import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";
import {
  DEFAULT_OBSERVATION_WINDOWS,
  AI_REVIEWED_ATTENUATION,
  AI_DISMISSED_ATTENUATION,
} from "../../config/risk-config.js";

/**
 * AI anomaly dimension (§36 - AI is an informer, not an authority).
 *
 * Consumes the REAL `AnomalyStatus` lifecycle
 * (new → reviewed → dismissed/investigated/acted_upon) with attenuation:
 *   - dismissed        → 0 (a human decided the advisory signal was not real;
 *                        the detector must not out-vote that decision)
 *   - investigated /
 *     acted_upon       → 0 (human has taken the signal to a conclusion; the
 *                        residual risk now lives in the outcome it produced -
 *                        findings, actions, inspections - not in the alert)
 *   - reviewed         → 0.75 (acknowledged but not yet concluded)
 *   - new              → 1.0
 *
 * Each anomaly is weighted by ITS OWN confidence (§36: outputs carry
 * confidence; one low-confidence alert must not be masked by - or inflate -
 * a high-confidence one).
 */
export class AiAnomalyDimensionCalculator {
  readonly dimension = "ai_anomaly" as const;
  private static readonly DEFAULT_CONFIDENCE = 0.8;

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const anomalies = ctx.aiAnomalies.anomalies;

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let unknownSeverityCount = 0;
    let dismissedCount = 0;
    let concludedCount = 0; // investigated | acted_upon
    let reviewedCount = 0;
    let newCount = 0;
    let confidenceSum = 0;

    for (const a of anomalies) {
      switch (a.status) {
        case "dismissed":
          dismissedCount++;
          continue;
        case "investigated":
        case "acted_upon":
          concludedCount++;
          continue;
        case "reviewed":
          reviewedCount++;
          break;
        case "new":
          newCount++;
          break;
        default:
          // Unknown status must not silently score as active.
          unknownSeverityCount++;
          break;
      }

      const confidence = Math.min(1, Math.max(0, a.confidence ?? AiAnomalyDimensionCalculator.DEFAULT_CONFIDENCE));
      confidenceSum += confidence;

      let base: number;
      switch (a.severity) {
        case "critical":
          criticalCount++;
          base = 25;
          break;
        case "high":
          highCount++;
          base = 15;
          break;
        case "medium":
          mediumCount++;
          base = 8;
          break;
        case "low":
          lowCount++;
          base = 3;
          break;
        default:
          unknownSeverityCount++;
          base = 8; // conservative default = MEDIUM weight
          break;
      }

      const attenuation = a.status === "reviewed" ? AI_REVIEWED_ATTENUATION : 1 - AI_DISMISSED_ATTENUATION;
      rawScore += base * confidence * attenuation;
    }

    const scoredCount = newCount + reviewedCount;
    const avgConfidence =
      scoredCount > 0 ? Math.round((confidenceSum / scoredCount) * 100) / 100 : 0;
    const activeCount = scoredCount + unknownSeverityCount;

    const normalizedScore = Math.min(100, Math.max(0, Math.round(rawScore)));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    let dataQuality: DataQuality = "sufficient";
    if (anomalies.length === 0) {
      dataQuality = "partial";
    }

    const explanation =
      activeCount > 0
        ? `AI Anomaly: ${activeCount} active advisory anomaly/anomalies (avg confidence ${avgConfidence}, ${criticalCount} critical, ${highCount} high; ${dismissedCount} dismissed, ${concludedCount} concluded) (normalized ${normalizedScore}/100)`
        : `AI Anomaly: No active advisory AI anomalies in past ${DEFAULT_OBSERVATION_WINDOWS.aiAnomalyDays}d (normalized 0/100)`;

    return {
      dimension: this.dimension,
      rawScore,
      normalizedScore,
      weight,
      weightedContribution,
      dataQuality,
      explanation,
      signals: {
        windowDays: DEFAULT_OBSERVATION_WINDOWS.aiAnomalyDays,
        totalAnomalies: anomalies.length,
        activeAnomaliesCount: activeCount,
        newCount,
        reviewedCount,
        concludedCount,
        dismissedCount,
        avgConfidence,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        unknownSeverityCount,
      },
    };
  }
}
