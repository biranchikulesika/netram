export interface RiskDimensionWeights {
  financial: number;
  inspectionQuality: number;
  attendanceAnomaly: number;
  complaintDensity: number;
  aiAnomaly: number;
}

export interface RiskThresholds {
  lowMax: number;       // e.g. 24
  mediumMax: number;    // e.g. 49
  highMax: number;      // e.g. 74
  criticalMin: number;  // e.g. 75
}

export interface SchedulingPolicy {
  autoScheduleThreshold: number; // e.g. 50
  cooldownDays: number;          // e.g. 7
  criticalOverrideThreshold: number; // e.g. 75
}

export interface ObservationWindows {
  attendanceDays: number;  // e.g. 30
  complaintDays: number;   // e.g. 90
  aiAnomalyDays: number;   // e.g. 60
  inspectionDays: number; // e.g. 180
}

export const DEFAULT_RISK_WEIGHTS: RiskDimensionWeights = {
  financial: 40,
  inspectionQuality: 25,
  attendanceAnomaly: 20,
  complaintDensity: 10,
  aiAnomaly: 5,
};

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  lowMax: 24,
  mediumMax: 49,
  highMax: 74,
  criticalMin: 75,
};

export const DEFAULT_SCHEDULING_POLICY: SchedulingPolicy = {
  autoScheduleThreshold: 50,
  cooldownDays: 7,
  criticalOverrideThreshold: 75,
};

export const DEFAULT_OBSERVATION_WINDOWS: ObservationWindows = {
  attendanceDays: 30,
  complaintDays: 90,
  aiAnomalyDays: 60,
  inspectionDays: 180,
};

export const SCORING_VERSION = "project-risk-v2";

/**
 * Review-state attenuation factors (§32, §36).
 *
 * The composite score measures CURRENT risk, so the lifecycle state of each
 * signal must matter: a signal a human has reviewed to a conclusion must not
 * keep contributing its full detector weight, and a signal a human has
 * declared NOT real must contribute nothing at all (AI is an informer, not an
 * authority — a dismissal is the human decision that overrides the detector).
 *
 * - RESOLVED_OUTCOME_ATTENUATION applies to signals a human acted upon to a
 *   concluded outcome (resolved complaint, actioned attendance anomaly): the
 *   underlying signal was real but is now remediated, so it retains a small
 *   residual weight.
 * - AI lifecycle attenuation (applied inside the AI dimension) is sharper:
 *   dismissed AI anomalies contribute 0, reviewed/investigated ones retain
 *   0.75 until a human reaches a terminal decision (§36 lifecycle).
 */
export const RESOLVED_OUTCOME_ATTENUATION = 0.25;
export const AI_REVIEWED_ATTENUATION = 0.75;
export const AI_DISMISSED_ATTENUATION = 0;

export function validateRiskWeights(weights: RiskDimensionWeights): void {
  const sum =
    weights.financial +
    weights.inspectionQuality +
    weights.attendanceAnomaly +
    weights.complaintDensity +
    weights.aiAnomaly;

  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(`Risk weights must sum to 100. Current sum: ${sum}`);
  }
}
