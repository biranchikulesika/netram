import type {
  AttendanceAnomalySeverity,
  AttendanceAnomalyState,
  AttendanceAnomalyType,
  AttendanceConfig,
  CoverageLevel,
  DataQualityLevel,
} from "@netram/types";
import { ATTENDANCE_ANOMALY_TRANSITIONS } from "@netram/types";

/**
 * Hybrid attendance anomaly detector (§26-§29). Statistical/rule-based - no
 * ML model required. AI/analytics output is evidence for human review, never
 * administrative authority.
 */

export const ATTENDANCE_DETECTOR_VERSION = "attendance-hybrid-0.1";

export class InvalidAttendanceAnomalyTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAttendanceAnomalyTransitionError";
  }
}

export function evaluateAttendanceAnomalyTransition(
  from: AttendanceAnomalyState,
  to: AttendanceAnomalyState,
): { to: AttendanceAnomalyState } {
  if (!ATTENDANCE_ANOMALY_TRANSITIONS[from].includes(to)) {
    throw new InvalidAttendanceAnomalyTransitionError(
      `Attendance anomaly cannot move from ${from} to ${to}.`,
    );
  }
  return { to };
}

export function reviewActionForState(state: AttendanceAnomalyState): AttendanceReviewActionValue {
  switch (state) {
    case "DISMISSED":
      return "dismiss";
    case "FALSE_POSITIVE":
      return "false_positive";
    case "INVESTIGATING":
      return "investigate";
    case "ACTIONED":
      return "actioned";
    default:
      return "acknowledge";
  }
}

export type AttendanceReviewActionValue =
  | "acknowledge"
  | "dismiss"
  | "false_positive"
  | "investigate"
  | "actioned"
  | "link_inspection"
  | "link_complaint"
  | "note";

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/* ---------- Signals (§27-§29) ---------- */

export interface HistoricalBaseline {
  count: number;
  median: number;
  deviationRatio: number;
}

export function historicalBaseline(
  priorPresentValues: number[],
  currentPresent: number,
): HistoricalBaseline {
  if (priorPresentValues.length === 0) {
    return { count: 0, median: currentPresent, deviationRatio: 0 };
  }
  const med = median(priorPresentValues);
  const deviationRatio = Math.abs(currentPresent - med) / Math.max(med, 1);
  return { count: priorPresentValues.length, median: med, deviationRatio };
}

export interface CrossSourceSignal {
  difference: number;
  relative: number;
}

/** Returns null when either source has no observation (no claim possible). */
export function crossSourceSignal(
  biometric: number | null,
  reported: number | null,
  expected: number | null,
): CrossSourceSignal | null {
  if (biometric === null || reported === null) return null;
  const difference = Math.abs(biometric - reported);
  const denom = expected !== null && expected > 0 ? expected : Math.max(biometric, reported, 1);
  return { difference, relative: difference / denom };
}

/** Trailing streak of days where present fell below `lowRatio` of expected. */
export function persistenceStreak(
  presentValues: number[],
  expected: number | null,
  lowRatio: number,
): number {
  if (expected === null || expected <= 0) return 0;
  let streak = 0;
  for (let i = presentValues.length - 1; i >= 0; i--) {
    if (presentValues[i]! / expected < lowRatio) streak += 1;
    else break;
  }
  return streak;
}

/* ---------- Scoring (§26) ---------- */

export function severityFor(score: number): AttendanceAnomalySeverity {
  if (score >= 0.7) return "CRITICAL";
  if (score >= 0.5) return "HIGH";
  if (score >= 0.3) return "MEDIUM";
  return "LOW";
}

export function confidenceFor(
  score: number,
  coverage: CoverageLevel,
  dataQuality: DataQualityLevel,
): number {
  const coverageFactor = coverage === "COMPLETE" ? 1 : coverage === "PARTIAL" ? 0.5 : 0.2;
  const qualityFactor = dataQuality === "GOOD" ? 1 : dataQuality === "DEGRADED" ? 0.5 : 0.2;
  return clamp01(score * 0.5 + 0.3 * coverageFactor + 0.2 * qualityFactor);
}

export interface DetectorInput {
  present: number;
  expected: number | null;
  /** Prior present values (excluding today), oldest → newest. */
  history: number[];
  biometricCount: number | null;
  reportedCount: number | null;
  cctvCount: number | null;
  coverage: CoverageLevel;
  dataQuality: DataQualityLevel;
  config: AttendanceConfig;
}

export interface DetectorCandidate {
  anomalyType: AttendanceAnomalyType;
  score: number;
  severity: AttendanceAnomalySeverity;
  confidence: number;
  supportingSignals: Record<string, unknown>;
}

function candidate(
  anomalyType: AttendanceAnomalyType,
  score: number,
  input: DetectorInput,
  signals: Record<string, unknown>,
): DetectorCandidate {
  const clamped = clamp01(score);
  return {
    anomalyType,
    score: clamped,
    severity: severityFor(clamped),
    confidence: confidenceFor(clamped, input.coverage, input.dataQuality),
    supportingSignals: {
      ...signals,
      dataQuality: input.dataQuality,
      coverage: input.coverage,
    },
  };
}

export function detectAnomalies(input: DetectorInput): DetectorCandidate[] {
  const candidates: DetectorCandidate[] = [];
  const th = input.config.thresholds;

  // 1. Cross-source discrepancy (biometric vs institution-reported) (§28).
  const cross = crossSourceSignal(input.biometricCount, input.reportedCount, input.expected);
  if (cross && cross.relative >= th.crossSourceDiscrepancy) {
    candidates.push(
      candidate("CROSS_SOURCE_DISCREPANCY", cross.relative, input, {
        difference: cross.difference,
        relative: cross.relative,
        biometric: input.biometricCount,
        reported: input.reportedCount,
        expected: input.expected,
      }),
    );
  }

  // 2. Historical deviation vs median baseline (§27).
  const base = historicalBaseline(input.history, input.present);
  if (
    input.history.length >= input.config.baseline.minObservations &&
    base.deviationRatio >= th.historicalDeviation
  ) {
    candidates.push(
      candidate("HISTORICAL_DEVIATION", base.deviationRatio, input, {
        deviationRatio: base.deviationRatio,
        baselineMedian: base.median,
        baselineCount: base.count,
        present: input.present,
      }),
    );
  }

  // 3. Persistence: sustained low attendance across the configured window (§26).
  const LOW_RATIO = 0.6;
  const streak = persistenceStreak([...input.history, input.present], input.expected, LOW_RATIO);
  if (input.expected !== null && streak >= th.persistenceWindowDays) {
    candidates.push(
      candidate("PERSISTENT_LOW_ATTENDANCE", 0.35 + 0.1 * streak, input, {
        streakDays: streak,
        lowRatio: LOW_RATIO,
        expected: input.expected,
      }),
    );
  }

  // 4. Source quality (informational - "bad data" is not "bad behaviour") (§25).
  if (
    input.dataQuality === "POOR" ||
    input.coverage === "INSUFFICIENT" ||
    input.coverage === "UNAVAILABLE"
  ) {
    candidates.push(
      candidate("SOURCE_QUALITY", 0.25, input, {
        dataQuality: input.dataQuality,
        coverage: input.coverage,
        note: "Insufficient source coverage; attendance result has reduced confidence.",
      }),
    );
  }

  return candidates;
}

/* ---------- Grouping & late data (§20, §32, §33) ---------- */

export function groupKeyFor(
  projectId: string,
  populationId: string | null,
  anomalyType: AttendanceAnomalyType,
): string {
  return `${projectId}:${populationId ?? "all"}:${anomalyType}`;
}

export function groupWithinProximity(openedAt: Date, now: Date, proximityDays: number): boolean {
  const cutoff = now.getTime() - proximityDays * 24 * 60 * 60 * 1000;
  return openedAt.getTime() >= cutoff;
}

export function materialityExceeded(
  previousScore: number,
  newScore: number,
  threshold: number,
): boolean {
  return Math.abs(newScore - previousScore) >= threshold;
}
