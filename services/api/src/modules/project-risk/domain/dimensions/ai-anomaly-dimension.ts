import type { DimensionResult, DataQuality } from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../../application/project-risk-context.js";
import { DEFAULT_OBSERVATION_WINDOWS } from "../../config/risk-config.js";

export class AiAnomalyDimensionCalculator {
  readonly dimension = "ai_anomaly" as const;

  calculate(ctx: ProjectRiskEvaluationContext, weight: number): DimensionResult {
    let rawScore = 0;
    const anomalies = ctx.aiAnomalies.anomalies;

    const activeAnomalies = anomalies.filter(
      (a) => a.status !== "dismissed" && a.status !== "resolved",
    );

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let confidenceSum = 0;

    for (const a of activeAnomalies) {
      confidenceSum += a.confidence ?? 0.8;
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

    const avgConfidence =
      activeAnomalies.length > 0
        ? Math.round((confidenceSum / activeAnomalies.length) * 100) / 100
        : 0;

    // Scale by average confidence
    if (activeAnomalies.length > 0 && avgConfidence > 0) {
      rawScore = Math.round(rawScore * avgConfidence);
    }

    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    const weightedContribution = Math.round(((normalizedScore * weight) / 100) * 10) / 10;

    let dataQuality: DataQuality = "sufficient";
    if (anomalies.length === 0) {
      dataQuality = "partial";
    }

    const explanation =
      activeAnomalies.length > 0
        ? `AI Anomaly: ${activeAnomalies.length} active advisory anomaly/anomalies (avg confidence: ${avgConfidence}, ${criticalCount} critical, ${highCount} high) (normalized ${normalizedScore}/100)`
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
        activeAnomaliesCount: activeAnomalies.length,
        avgConfidence,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
      },
    };
  }
}
