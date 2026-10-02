import { z } from "zod";
import {
  ATTENDANCE_ANOMALY_SEVERITIES,
  ATTENDANCE_ANOMALY_STATES,
  ATTENDANCE_ANOMALY_TYPES,
  ATTENDANCE_CORRECTION_STATUSES,
  ATTENDANCE_EVENT_TYPES,
  ATTENDANCE_EXPORT_FORMATS,
  ATTENDANCE_EXPORT_STATUSES,
  ATTENDANCE_REVIEW_ACTIONS,
  ATTENDANCE_SOURCES,
  COVERAGE_LEVELS,
  DATA_QUALITY_LEVELS,
  DEVICE_HEALTH_STATUSES,
  EXPECTED_POPULATION_STRATEGIES,
  POPULATION_TYPES,
  RAW_TRANSACTION_STATUSES,
} from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

/* ---------- Provider ingest ---------- */

export const providerDeviceEventSchema = z
  .object({
    deviceEventId: z.string().max(200).nullable().optional(),
    externalUserId: z.string().max(200),
    rawType: z.enum(ATTENDANCE_EVENT_TYPES).or(z.string().max(50)).optional(),
    occurredAt: z.string().datetime(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

export const syncDeviceEventsSchema = z
  .object({
    events: z.array(providerDeviceEventSchema).max(5000),
    syncCursor: z.string().max(200).nullable().optional(),
  })
  .strict();

/* ---------- Source observations (reported/CCTV) ---------- */

export const recordSourceObservationSchema = z
  .object({
    projectId: uuidSchema,
    source: z.enum(ATTENDANCE_SOURCES),
    windowId: uuidSchema.nullable().optional(),
    operationalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
    observedAt: z.string().datetime(),
    observedCount: z.number().int().nonnegative().nullable().optional(),
    expectedCount: z.number().int().nonnegative().nullable().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    coverage: z.enum(COVERAGE_LEVELS).optional(),
    health: z.enum(DEVICE_HEALTH_STATUSES).optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

/* ---------- Entities (read models) ---------- */

const deviceSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  name: z.string().max(200),
  provider: z.string().max(100),
  deviceExternalId: z.string().max(200),
  status: z.enum(DEVICE_HEALTH_STATUSES),
  lastSeenAt: z.string().datetime().nullable(),
  lastEventAt: z.string().datetime().nullable(),
  syncCursor: z.string().max(200).nullable(),
  createdAt: z.string().datetime(),
});

const sourceCountsSchema = z.record(z.enum(ATTENDANCE_SOURCES), z.number().int().nonnegative());

const calculationSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  projectCode: z.string(),
  projectName: z.string(),
  windowId: uuidSchema,
  operationalDate: z.string(),
  expected: z.number().int().nonnegative().nullable(),
  present: z.number().int().nonnegative(),
  absent: z.number().int().nonnegative().nullable(),
  unknown: z.number().int().nonnegative(),
  sourceCounts: sourceCountsSchema,
  coverage: z.enum(COVERAGE_LEVELS),
  dataQuality: z.enum(DATA_QUALITY_LEVELS),
  freshness: z.string().datetime().nullable(),
  policy: z.record(z.string(), z.unknown()),
  computedAt: z.string().datetime(),
});

const anomalySchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  populationId: uuidSchema.nullable(),
  windowId: uuidSchema.nullable(),
  operationalDate: z.string().nullable(),
  observationStart: z.string().datetime(),
  observationEnd: z.string().datetime(),
  anomalyType: z.enum(ATTENDANCE_ANOMALY_TYPES),
  score: z.number().min(0).max(1),
  severity: z.enum(ATTENDANCE_ANOMALY_SEVERITIES),
  confidence: z.number().min(0).max(1),
  dataQuality: z.enum(DATA_QUALITY_LEVELS),
  detectorVersion: z.string().max(50),
  supportingSignals: z.record(z.string(), z.unknown()),
  state: z.enum(ATTENDANCE_ANOMALY_STATES),
  reviewedBy: uuidSchema.nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewNotes: z.string().max(2000).nullable(),
  groupId: uuidSchema.nullable(),
  linkedInspectionId: uuidSchema.nullable(),
  linkedComplaintId: uuidSchema.nullable(),
  sourceData: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  projectCode: z.string().max(50).nullable(),
  projectName: z.string().max(300).nullable(),
  districtId: uuidSchema.nullable(),
});

const drillDownRowSchema = z.object({
  personExternalId: z.string(),
  netramUserId: uuidSchema.nullable(),
  eventType: z.enum(ATTENDANCE_EVENT_TYPES),
  occurredAt: z.string().datetime(),
  deviceName: z.string().max(200).nullable(),
  windowCode: z.string().max(50).nullable(),
});

const dataQualitySchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  source: z.enum(ATTENDANCE_SOURCES),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  coverage: z.enum(COVERAGE_LEVELS),
  freshness: z.string().datetime().nullable(),
  duplicateRate: z.number().min(0).nullable(),
  invalidCount: z.number().int().nonnegative(),
  unmatchedCount: z.number().int().nonnegative(),
  health: z.enum(DEVICE_HEALTH_STATUSES),
  assessedAt: z.string().datetime(),
});

const sourceObservationSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  source: z.enum(ATTENDANCE_SOURCES),
  windowId: uuidSchema.nullable(),
  operationalDate: z.string(),
  observedAt: z.string().datetime(),
  observedCount: z.number().int().nonnegative().nullable(),
  expectedCount: z.number().int().nonnegative().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  coverage: z.enum(COVERAGE_LEVELS),
  health: z.enum(DEVICE_HEALTH_STATUSES),
  note: z.string().max(1000).nullable(),
});

const correctionSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  targetType: z.string(),
  targetId: uuidSchema,
  field: z.string(),
  originalValue: z.record(z.string(), z.unknown()),
  newValue: z.record(z.string(), z.unknown()),
  reason: z.string().min(1).max(2000),
  requestedBy: uuidSchema,
  status: z.enum(ATTENDANCE_CORRECTION_STATUSES),
  approvedBy: uuidSchema.nullable(),
  approvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

const exportSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  requestedBy: uuidSchema,
  scope: z.record(z.string(), z.unknown()),
  status: z.enum(ATTENDANCE_EXPORT_STATUSES),
  format: z.enum(ATTENDANCE_EXPORT_FORMATS),
  artifactKey: z.string().max(300).nullable(),
  recordCount: z.number().int().nonnegative().nullable(),
  requestedAt: z.string().datetime(),
  generatedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  downloadedAt: z.string().datetime().nullable(),
  error: z.string().max(1000).nullable(),
});

const configSchema = z.object({
  projectId: uuidSchema.nullable(),
  dayStartTime: timeSchema,
  thresholds: z.object({
    crossSourceDiscrepancy: z.number().min(0).max(1),
    historicalDeviation: z.number().min(0).max(1),
    persistenceWindowDays: z.number().int().positive(),
    materialityThreshold: z.number().min(0).max(1),
  }),
  baseline: z.object({
    windowDays: z.number().int().positive(),
    minObservations: z.number().int().positive(),
  }),
  retention: z.object({
    rawTransactionsDays: z.number().int().positive(),
    exportsHours: z.number().int().positive(),
  }),
  updatedAt: z.string().datetime(),
});

/* ---------- Page schemas ---------- */

const anomalyPageSchema = z.object({
  items: z.array(anomalySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

const calculationPageSchema = z.object({
  items: z.array(calculationSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

/* ---------- Query schemas ---------- */

export const attendanceOverviewQuerySchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
  districtId: uuidSchema.optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
});

export const attendanceCalculationQuerySchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
  windowId: uuidSchema.optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
});

export const attendanceAnomalyQuerySchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
  type: z.enum(ATTENDANCE_ANOMALY_TYPES).optional(),
  severity: z.enum(ATTENDANCE_ANOMALY_SEVERITIES).optional(),
  state: z.enum(ATTENDANCE_ANOMALY_STATES).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
});

export const attendanceDrillDownQuerySchema = z.object({
  projectId: uuidSchema,
  windowId: uuidSchema.optional(),
  operationalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
  personExternalId: z.string().max(200).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
});

export const attendanceExportQuerySchema = z.object({
  projectId: uuidSchema.optional(),
  districtId: uuidSchema.optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
});

/* ---------- Action schemas ---------- */

export const attendanceAnomalyReviewSchema = z
  .object({
    action: z.enum(ATTENDANCE_REVIEW_ACTIONS),
    note: z.string().max(2000).nullable().optional(),
    linkedInspectionId: uuidSchema.nullable().optional(),
    linkedComplaintId: uuidSchema.nullable().optional(),
  })
  .strict();

export const attendanceCorrectionSchema = z
  .object({
    projectId: uuidSchema,
    targetType: z.enum(["calculation", "anomaly", "event"]),
    targetId: uuidSchema,
    field: z.string().min(1).max(100),
    newValue: z.record(z.string(), z.unknown()),
    reason: z.string().min(1).max(2000),
  })
  .strict();

export const attendanceCorrectionApprovalSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const attendanceConfigUpdateSchema = z
  .object({
    dayStartTime: timeSchema.optional(),
    thresholds: z
      .object({
        crossSourceDiscrepancy: z.number().min(0).max(1).optional(),
        historicalDeviation: z.number().min(0).max(1).optional(),
        persistenceWindowDays: z.number().int().positive().optional(),
        materialityThreshold: z.number().min(0).max(1).optional(),
      })
      .optional(),
    baseline: z
      .object({
        windowDays: z.number().int().positive().optional(),
        minObservations: z.number().int().positive().optional(),
      })
      .optional(),
    retention: z
      .object({
        rawTransactionsDays: z.number().int().positive().optional(),
        exportsHours: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .strict();

export {
  deviceSchema,
  calculationSchema,
  anomalySchema,
  drillDownRowSchema,
  dataQualitySchema,
  sourceObservationSchema,
  correctionSchema,
  exportSchema,
  configSchema,
  anomalyPageSchema,
  calculationPageSchema,
};

/* Re-export raw status enums for downstream schemas/tests. */
export {
  ATTENDANCE_EVENT_TYPES,
  ATTENDANCE_SOURCES,
  RAW_TRANSACTION_STATUSES,
  POPULATION_TYPES,
  EXPECTED_POPULATION_STRATEGIES,
  DEVICE_HEALTH_STATUSES,
  COVERAGE_LEVELS,
  DATA_QUALITY_LEVELS,
  ATTENDANCE_ANOMALY_TYPES,
  ATTENDANCE_ANOMALY_SEVERITIES,
  ATTENDANCE_ANOMALY_STATES,
  ATTENDANCE_REVIEW_ACTIONS,
  ATTENDANCE_CORRECTION_STATUSES,
  ATTENDANCE_EXPORT_FORMATS,
  ATTENDANCE_EXPORT_STATUSES,
};
