import type { UUID, ISODateTime } from "./common.js";

/**
 * Attendance & Attendance Anomaly domain contracts.
 *
 * Attendance is multi-source from day one; raw transactions are preserved;
 * anomaly intelligence is separate from attendance truth; anomalies are
 * official/internal-only and human-reviewable. See
 * docs/domain/attendance.md for the full model.
 */

/* ---------- Sources & events ---------- */

export const ATTENDANCE_SOURCES = [
  "BIOMETRIC",
  "INSTITUTION_REPORTED",
  "CCTV",
  "MANUAL",
] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

export const ATTENDANCE_EVENT_TYPES = [
  "CHECK_IN",
  "CHECK_OUT",
  "FINGERPRINT_VERIFIED",
  "PRESENCE",
] as const;
export type AttendanceEventType = (typeof ATTENDANCE_EVENT_TYPES)[number];

export const RAW_TRANSACTION_STATUSES = ["RECEIVED", "NORMALIZED", "UNMATCHED", "ERROR"] as const;
export type RawTransactionStatus = (typeof RAW_TRANSACTION_STATUSES)[number];

/** Normalized attendance event lifecycle. */
export const ATTENDANCE_EVENT_STATUSES = ["NORMALIZED", "COUNTED", "DEDUPLICATED"] as const;
export type AttendanceEventStatus = (typeof ATTENDANCE_EVENT_STATUSES)[number];

/* ---------- Device health ---------- */

export const DEVICE_HEALTH_STATUSES = ["ONLINE", "OFFLINE", "STALE", "UNKNOWN"] as const;
export type DeviceHealthStatus = (typeof DEVICE_HEALTH_STATUSES)[number];

/* ---------- Coverage & data quality ---------- */

export const COVERAGE_LEVELS = ["COMPLETE", "PARTIAL", "INSUFFICIENT", "UNAVAILABLE"] as const;
export type CoverageLevel = (typeof COVERAGE_LEVELS)[number];

export const DATA_QUALITY_LEVELS = ["GOOD", "DEGRADED", "POOR", "UNKNOWN"] as const;
export type DataQualityLevel = (typeof DATA_QUALITY_LEVELS)[number];

/* ---------- Populations ---------- */

export const POPULATION_TYPES = ["BENEFICIARY", "STAFF", "GENERIC"] as const;
export type PopulationType = (typeof POPULATION_TYPES)[number];

export const EXPECTED_POPULATION_STRATEGIES = ["ROSTER", "CONFIGURED"] as const;
export type ExpectedPopulationStrategy = (typeof EXPECTED_POPULATION_STRATEGIES)[number];

/* ---------- Anomalies ---------- */

export const ATTENDANCE_ANOMALY_TYPES = [
  "CROSS_SOURCE_DISCREPANCY",
  "HISTORICAL_DEVIATION",
  "PERSISTENT_LOW_ATTENDANCE",
  "SOURCE_QUALITY",
] as const;
export type AttendanceAnomalyType = (typeof ATTENDANCE_ANOMALY_TYPES)[number];

export const ATTENDANCE_ANOMALY_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type AttendanceAnomalySeverity = (typeof ATTENDANCE_ANOMALY_SEVERITIES)[number];

export const ATTENDANCE_ANOMALY_STATES = [
  "NEW",
  "REVIEWED",
  "DISMISSED",
  "FALSE_POSITIVE",
  "INVESTIGATING",
  "ACTIONED",
] as const;
export type AttendanceAnomalyState = (typeof ATTENDANCE_ANOMALY_STATES)[number];

/** Stable core state machine; transitions are policy-driven (§31). */
export const ATTENDANCE_ANOMALY_TRANSITIONS: Record<
  AttendanceAnomalyState,
  readonly AttendanceAnomalyState[]
> = {
  NEW: ["REVIEWED", "DISMISSED", "FALSE_POSITIVE", "INVESTIGATING"],
  REVIEWED: ["INVESTIGATING", "ACTIONED", "DISMISSED", "FALSE_POSITIVE"],
  INVESTIGATING: ["ACTIONED", "DISMISSED", "FALSE_POSITIVE"],
  DISMISSED: [],
  FALSE_POSITIVE: [],
  ACTIONED: [],
};

export const ATTENDANCE_REVIEW_ACTIONS = [
  "acknowledge",
  "dismiss",
  "false_positive",
  "investigate",
  "actioned",
  "link_inspection",
  "link_complaint",
  "note",
] as const;
export type AttendanceReviewAction = (typeof ATTENDANCE_REVIEW_ACTIONS)[number];

/* ---------- Corrections ---------- */

export const ATTENDANCE_CORRECTION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type AttendanceCorrectionStatus = (typeof ATTENDANCE_CORRECTION_STATUSES)[number];

/* ---------- Exports ---------- */

export const ATTENDANCE_EXPORT_STATUSES = [
  "REQUESTED",
  "GENERATING",
  "READY",
  "FAILED",
  "EXPIRED",
] as const;
export type AttendanceExportStatus = (typeof ATTENDANCE_EXPORT_STATUSES)[number];

export const ATTENDANCE_EXPORT_FORMATS = ["csv"] as const;
export type AttendanceExportFormat = (typeof ATTENDANCE_EXPORT_FORMATS)[number];

/* ---------- Entities ---------- */

export interface AttendanceDevice {
  id: UUID;
  projectId: UUID;
  name: string;
  provider: string;
  deviceExternalId: string;
  status: DeviceHealthStatus;
  lastSeenAt: ISODateTime | null;
  lastEventAt: ISODateTime | null;
  syncCursor: string | null;
  createdAt: ISODateTime;
}

export interface AttendancePopulation {
  id: UUID;
  projectId: UUID;
  code: string;
  name: string;
  populationType: PopulationType;
  expectedStrategy: ExpectedPopulationStrategy;
  /** Configured aggregate population (CONFIGURED strategy). */
  expectedCount: number | null;
  createdAt: ISODateTime;
}

export interface AttendancePopulationMember {
  id: UUID;
  populationId: UUID;
  personExternalId: string;
  netramUserId: UUID | null;
  joinedAt: ISODateTime;
}

export interface AttendanceIdentityMapping {
  id: UUID;
  projectId: UUID;
  deviceId: UUID;
  externalUserId: string;
  personExternalId: string;
  netramUserId: UUID | null;
  createdAt: ISODateTime;
}

export interface AttendanceWindow {
  id: UUID;
  projectId: UUID;
  code: string;
  name: string;
  /** Local wall-clock HH:MM (e.g. "06:00"). */
  startTime: string;
  /** Local wall-clock HH:MM (e.g. "09:00"). */
  endTime: string;
  populationId: UUID | null;
  /** Minimum source coverage required for a complete contribution. */
  minCoverage: number;
  config: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface AttendanceConfig {
  projectId: UUID | null;
  /** Operational day start, local wall-clock HH:MM (e.g. "05:00"). */
  dayStartTime: string;
  thresholds: {
    crossSourceDiscrepancy: number;
    historicalDeviation: number;
    persistenceWindowDays: number;
    materialityThreshold: number;
  };
  baseline: {
    windowDays: number;
    minObservations: number;
  };
  retention: {
    rawTransactionsDays: number;
    exportsHours: number;
  };
  updatedAt: ISODateTime;
}

export interface AttendanceRawTransaction {
  id: UUID;
  deviceId: UUID;
  externalUserId: string;
  deviceEventId: string | null;
  occurredAt: ISODateTime;
  receivedAt: ISODateTime;
  rawType: string;
  payload: Record<string, unknown> | null;
  syncCursor: string | null;
  status: RawTransactionStatus;
  /** null = mapped, "unmatched", "error:<msg>". */
  mappingStatus: string | null;
  error: string | null;
}

export interface AttendanceEvent {
  id: UUID;
  projectId: UUID;
  deviceId: UUID;
  populationId: UUID | null;
  personExternalId: string;
  netramUserId: UUID | null;
  eventType: AttendanceEventType;
  occurredAt: ISODateTime;
  receivedAt: ISODateTime;
  rawTransactionId: UUID;
  windowId: UUID | null;
  operationalDate: string | null;
  dedupKey: string | null;
  status: AttendanceEventStatus;
}

export interface AttendanceSourceObservation {
  id: UUID;
  projectId: UUID;
  source: AttendanceSource;
  windowId: UUID | null;
  operationalDate: string;
  observedAt: ISODateTime;
  observedCount: number | null;
  expectedCount: number | null;
  confidence: number | null;
  coverage: CoverageLevel;
  health: DeviceHealthStatus;
  note: string | null;
}

export interface AttendanceCalculation {
  id: UUID;
  projectId: UUID;
  windowId: UUID;
  operationalDate: string;
  expected: number | null;
  present: number;
  absent: number | null;
  unknown: number;
  sourceCounts: Record<AttendanceSource, number>;
  coverage: CoverageLevel;
  dataQuality: DataQualityLevel;
  /** ISO freshness of the freshest contributing source. */
  freshness: ISODateTime | null;
  policy: Record<string, unknown>;
  computedAt: ISODateTime;
}

export interface AttendanceDataQuality {
  id: UUID;
  projectId: UUID;
  source: AttendanceSource;
  periodStart: ISODateTime;
  periodEnd: ISODateTime;
  coverage: CoverageLevel;
  freshness: ISODateTime | null;
  duplicateRate: number | null;
  invalidCount: number;
  unmatchedCount: number;
  health: DeviceHealthStatus;
  assessedAt: ISODateTime;
}

export interface AttendanceAnomaly {
  id: UUID;
  projectId: UUID;
  populationId: UUID | null;
  windowId: UUID | null;
  operationalDate: string | null;
  observationStart: ISODateTime;
  observationEnd: ISODateTime;
  anomalyType: AttendanceAnomalyType;
  score: number;
  severity: AttendanceAnomalySeverity;
  confidence: number;
  dataQuality: DataQualityLevel;
  detectorVersion: string;
  supportingSignals: Record<string, unknown>;
  state: AttendanceAnomalyState;
  reviewedBy: UUID | null;
  reviewedAt: ISODateTime | null;
  reviewNotes: string | null;
  groupId: UUID | null;
  linkedInspectionId: UUID | null;
  linkedComplaintId: UUID | null;
  /** Immutable analytical snapshot used to preserve reviewed results. */
  sourceData: Record<string, unknown>;
  createdAt: ISODateTime;
  /** Join context for jurisdiction scoping. */
  projectCode: string | null;
  projectName: string | null;
  districtId: UUID | null;
}

export interface AttendanceAnomalyGroup {
  id: UUID;
  projectId: UUID;
  populationId: UUID | null;
  anomalyType: AttendanceAnomalyType;
  state: AttendanceAnomalyState;
  openedAt: ISODateTime;
  closedAt: ISODateTime | null;
}

export interface AttendanceReviewActionRecord {
  id: UUID;
  anomalyId: UUID;
  actorUserId: UUID;
  action: AttendanceReviewAction;
  note: string | null;
  createdAt: ISODateTime;
}

export interface AttendanceCorrection {
  id: UUID;
  projectId: UUID;
  /** "calculation" | "anomaly" | "event" */
  targetType: string;
  targetId: UUID;
  field: string;
  originalValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  reason: string;
  requestedBy: UUID;
  status: AttendanceCorrectionStatus;
  approvedBy: UUID | null;
  approvedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface AttendanceExport {
  id: UUID;
  projectId: UUID;
  requestedBy: UUID;
  scope: Record<string, unknown>;
  status: AttendanceExportStatus;
  format: AttendanceExportFormat;
  artifactKey: string | null;
  recordCount: number | null;
  requestedAt: ISODateTime;
  generatedAt: ISODateTime | null;
  expiresAt: ISODateTime | null;
  downloadedAt: ISODateTime | null;
  error: string | null;
}

/* ---------- API DTOs ---------- */

export interface AttendanceOverviewItem {
  projectId: UUID;
  projectCode: string;
  projectName: string;
  districtId: UUID | null;
  windowId: UUID;
  windowCode: string;
  operationalDate: string;
  expected: number | null;
  present: number;
  coverage: CoverageLevel;
  dataQuality: DataQualityLevel;
  openAnomalyCount: number;
  latestComputedAt: ISODateTime;
  sourceCounts: Record<AttendanceSource, number>;
}

export interface AttendanceAnomalyPage {
  items: AttendanceAnomaly[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendanceCalculationPage {
  items: AttendanceCalculation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendanceDrillDownRow {
  personExternalId: string;
  netramUserId: UUID | null;
  eventType: AttendanceEventType;
  occurredAt: ISODateTime;
  deviceName: string | null;
  windowCode: string | null;
}

export interface AttendanceDeviceHealthRow {
  id: UUID;
  projectId: UUID;
  projectCode: string;
  projectName: string;
  name: string;
  status: DeviceHealthStatus;
  lastSeenAt: ISODateTime | null;
  lastEventAt: ISODateTime | null;
  stale: boolean;
}

export interface AttendanceOverviewQuery {
  projectId?: UUID;
  districtId?: UUID;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AttendanceExportQuery {
  projectId?: UUID;
  districtId?: UUID;
  from?: string;
  to?: string;
}

export interface AttendanceAnomalyReviewInput {
  action: AttendanceReviewAction;
  note?: string | null;
  linkedInspectionId?: UUID | null;
  linkedComplaintId?: UUID | null;
}

export interface AttendanceCorrectionInput {
  projectId: UUID;
  targetType: "calculation" | "anomaly" | "event";
  targetId: UUID;
  field: string;
  newValue: Record<string, unknown>;
  reason: string;
}

export interface AttendanceConfigInput {
  dayStartTime?: string;
  thresholds?: Partial<AttendanceConfig["thresholds"]>;
  baseline?: Partial<AttendanceConfig["baseline"]>;
  retention?: Partial<AttendanceConfig["retention"]>;
}