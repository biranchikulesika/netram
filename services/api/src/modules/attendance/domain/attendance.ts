import type {
  AttendanceEvent,
  AttendanceEventType,
  AttendanceSource,
  AttendanceWindow,
  CoverageLevel,
  DataQualityLevel,
} from "@netram/types";

/**
 * Pure attendance domain logic (AGENTS.md §23-§25). Deterministic and provider-independent. Wall-clock times are
 * treated as UTC for reproducibility (dev/seed data is UTC).
 */

export const ATTENDANCE_CALCULATION_VERSION = "attendance-calc-0.1";

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (
    h === undefined ||
    m === undefined ||
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    throw new Error(`Invalid HH:MM time: "${hhmm}"`);
  }
  return h * 60 + m;
}

/**
 * Operational day containing `t` (§15). If the wall-clock time is before the
 * configured day start, the event belongs to the previous calendar day's
 * operational day.
 */
export function operationalDayFor(t: Date, dayStartTime: string): string {
  const dayStart = hhmmToMinutes(dayStartTime);
  const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
  const day = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  if (minutes < dayStart) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** Whether a timestamp falls inside [startTime, endTime], supporting midnight wrap. */
export function inWindow(t: Date, startTime: string, endTime: string): boolean {
  const start = hhmmToMinutes(startTime);
  let end = hhmmToMinutes(endTime);
  let minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (end < start) {
    end += 24 * 60;
    if (minutes < start) minutes += 24 * 60;
  }
  return minutes >= start && minutes <= end;
}

const RAW_TO_EVENT: Record<string, AttendanceEventType> = {
  "check-in": "CHECK_IN",
  check_in: "CHECK_IN",
  CHECK_IN: "CHECK_IN",
  "check-out": "CHECK_OUT",
  check_out: "CHECK_OUT",
  CHECK_OUT: "CHECK_OUT",
  fingerprint: "FINGERPRINT_VERIFIED",
  fingerprint_verified: "FINGERPRINT_VERIFIED",
  FINGERPRINT_VERIFIED: "FINGERPRINT_VERIFIED",
  verify: "FINGERPRINT_VERIFIED",
  presence: "PRESENCE",
  PRESENCE: "PRESENCE",
  CHECKIN: "CHECK_IN",
  CHECKOUT: "CHECK_OUT",
};

/** Provider-independent normalization of raw event types (§16). Unknown → PRESENCE. */
export function normalizeEventType(rawType: string | null | undefined): AttendanceEventType {
  if (!rawType) return "PRESENCE";
  return RAW_TO_EVENT[rawType] ?? "PRESENCE";
}

/**
 * Deduplication key (§7, §18): one person counts once per window per
 * operational day, regardless of how many devices or transactions fired.
 */
export function dedupKeyFor(
  projectId: string,
  windowId: string | null,
  operationalDate: string,
  personExternalId: string,
): string {
  return `${projectId}:${operationalDate}:${windowId ?? "nowin"}:${personExternalId}`;
}

/** CHECK_IN / FINGERPRINT_VERIFIED / PRESENCE / CHECK_OUT all establish presence. */
export function eventEstablishesPresence(eventType: AttendanceEventType): boolean {
  return (
    eventType === "CHECK_IN" ||
    eventType === "CHECK_OUT" ||
    eventType === "FINGERPRINT_VERIFIED" ||
    eventType === "PRESENCE"
  );
}

/* ---------- Coverage (§21) ---------- */

export interface SourceCoverageInput {
  source: AttendanceSource;
  coverage: CoverageLevel;
}

export function overallCoverage(inputs: SourceCoverageInput[]): CoverageLevel {
  const contributing = inputs.filter((i) => i.coverage !== "UNAVAILABLE");
  if (contributing.length === 0) return "UNAVAILABLE";
  if (contributing.some((i) => i.coverage === "INSUFFICIENT")) return "INSUFFICIENT";
  if (contributing.some((i) => i.coverage === "PARTIAL")) return "PARTIAL";
  return "COMPLETE";
}

/* ---------- Data quality (§25) ---------- */

export interface DataQualityInput {
  coverage: CoverageLevel;
  duplicateRate: number | null;
  unmatchedCount: number;
  invalidCount: number;
  stale: boolean;
}

export function assessDataQuality(input: DataQualityInput): DataQualityLevel {
  if (input.coverage === "UNAVAILABLE" || input.coverage === "INSUFFICIENT") return "POOR";
  if (input.stale) return "DEGRADED";
  if ((input.duplicateRate ?? 0) > 0.3) return "DEGRADED";
  if (input.unmatchedCount > 0 || input.invalidCount > 0) return "DEGRADED";
  if (input.coverage === "PARTIAL") return "DEGRADED";
  return "GOOD";
}

/* ---------- Calculation (§23) ---------- */

export interface CalculateAttendanceInput {
  window: AttendanceWindow;
  /** Frozen at window start (§13). */
  expected: number | null;
  /** Already deduplicated unique persons present (across devices). */
  presentEvents: AttendanceEvent[];
  sourceCounts: Record<AttendanceSource, number>;
  sourceCoverage: SourceCoverageInput[];
  freshness: Date | null;
  duplicateRate: number | null;
  unmatchedCount: number;
  invalidCount: number;
  stale: boolean;
  policy: Record<string, unknown>;
}

export interface AttendanceCalcResult {
  expected: number | null;
  present: number;
  absent: number | null;
  unknown: number;
  sourceCounts: Record<AttendanceSource, number>;
  coverage: CoverageLevel;
  dataQuality: DataQualityLevel;
  freshness: Date | null;
  policy: Record<string, unknown>;
}

export function calculateAttendance(input: CalculateAttendanceInput): AttendanceCalcResult {
  const present = input.presentEvents.length;
  const coverage = overallCoverage(input.sourceCoverage);
  const dataQuality = assessDataQuality({
    coverage,
    duplicateRate: input.duplicateRate,
    unmatchedCount: input.unmatchedCount,
    invalidCount: input.invalidCount,
    stale: input.stale,
  });

  let absent: number | null = null;
  let unknown = 0;
  if (input.expected !== null) {
    if (coverage === "COMPLETE") {
      // Only under complete coverage is absence determinable (§23).
      absent = Math.max(0, input.expected - present);
    } else {
      unknown = Math.max(0, input.expected - present);
    }
  }

  return {
    expected: input.expected,
    present,
    absent,
    unknown,
    sourceCounts: input.sourceCounts,
    coverage,
    dataQuality,
    freshness: input.freshness,
    policy: input.policy,
  };
}
