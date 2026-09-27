import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  attendanceAnomalies as anomaliesTable,
  attendanceAnomalyGroups as groupsTable,
  attendanceCalculations as calculationsTable,
  attendanceConfigs as configsTable,
  attendanceCorrections as correctionsTable,
  attendanceDataQuality as dqTable,
  attendanceDevices as devicesTable,
  attendanceEvents as eventsTable,
  attendanceExports as exportsTable,
  attendanceIdentityMappings as identityMappingsTable,
  attendancePopulations as populationsTable,
  attendancePopulationMembers as membersTable,
  attendanceRawTransactions as rawTransactionsTable,
  attendanceReviewActions as reviewActionsTable,
  attendanceSourceObservations as observationsTable,
  attendanceWindows as windowsTable,
  auditEvents,
  outboxEvents,
  projects as projectsTable,
  users as usersTable,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  AttendanceAnomaly,
  AttendanceAnomalyGroup,
  AttendanceAnomalySeverity,
  AttendanceAnomalyState,
  AttendanceAnomalyType,
  AttendanceCalculation,
  AttendanceConfig,
  AttendanceCorrection,
  AttendanceCorrectionStatus,
  AttendanceDataQuality,
  AttendanceDevice,
  AttendanceEvent,
  AttendanceEventType,
  AttendanceExport,
  AttendanceExportStatus,
  AttendancePopulation,
  AttendanceRawTransaction,
  AttendanceReviewActionRecord,
  AttendanceSource,
  AttendanceSourceObservation,
  AttendanceWindow,
  AuditAction,
  CoverageLevel,
  DataQualityLevel,
  DeviceHealthStatus,
  DomainEventType,
  ExpectedPopulationStrategy,
  PopulationType,
  RawTransactionStatus,
} from "@netram/types";

/* ---------- Row shapes ---------- */

type DeviceRow = typeof devicesTable.$inferSelect;
type PopulationRow = typeof populationsTable.$inferSelect;
type MemberRow = typeof membersTable.$inferSelect;
type IdentityMappingRow = typeof identityMappingsTable.$inferSelect;
type WindowRow = typeof windowsTable.$inferSelect;
type ConfigRow = typeof configsTable.$inferSelect;
type RawRow = typeof rawTransactionsTable.$inferSelect;
type EventRow = typeof eventsTable.$inferSelect;
type ObservationRow = typeof observationsTable.$inferSelect;
type CalculationRow = typeof calculationsTable.$inferSelect;
type DqRow = typeof dqTable.$inferSelect;
type GroupRow = typeof groupsTable.$inferSelect;
type AnomalyRow = typeof anomaliesTable.$inferSelect;
type ReviewActionRow = typeof reviewActionsTable.$inferSelect;
type CorrectionRow = typeof correctionsTable.$inferSelect;
type ExportRow = typeof exportsTable.$inferSelect;

/* ---------- Mappers ---------- */

function toDevice(row: DeviceRow): AttendanceDevice {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    provider: row.provider,
    deviceExternalId: row.deviceExternalId,
    status: row.status as DeviceHealthStatus,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    syncCursor: row.syncCursor,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPopulation(row: PopulationRow): AttendancePopulation {
  return {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    name: row.name,
    populationType: row.populationType as PopulationType,
    expectedStrategy: row.expectedStrategy as ExpectedPopulationStrategy,
    expectedCount: row.expectedCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function toWindow(row: WindowRow): AttendanceWindow {
  return {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    populationId: row.populationId,
    minCoverage: row.minCoverage,
    config: row.config ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

function toConfig(row: ConfigRow): AttendanceConfig {
  return {
    projectId: row.projectId,
    dayStartTime: row.dayStartTime,
    thresholds: row.thresholds ?? {
      crossSourceDiscrepancy: 0.15,
      historicalDeviation: 0.25,
      persistenceWindowDays: 5,
      materialityThreshold: 0.1,
    },
    baseline: row.baseline ?? { windowDays: 14, minObservations: 5 },
    retention: row.retention ?? { rawTransactionsDays: 365, exportsHours: 24 },
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRawTransaction(row: RawRow): AttendanceRawTransaction {
  return {
    id: row.id,
    deviceId: row.deviceId,
    externalUserId: row.externalUserId,
    deviceEventId: row.deviceEventId,
    occurredAt: row.occurredAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    rawType: row.rawType,
    payload: row.payload,
    syncCursor: row.syncCursor,
    status: row.status as RawTransactionStatus,
    mappingStatus: row.mappingStatus,
    error: row.error,
  };
}

function toEvent(row: EventRow): AttendanceEvent {
  return {
    id: row.id,
    projectId: row.projectId,
    deviceId: row.deviceId,
    populationId: row.populationId,
    personExternalId: row.personExternalId,
    netramUserId: row.netramUserId,
    eventType: row.eventType as AttendanceEventType,
    occurredAt: row.occurredAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    rawTransactionId: row.rawTransactionId,
    windowId: row.windowId,
    operationalDate: row.operationalDate,
    dedupKey: row.dedupKey,
    status: row.status as AttendanceEvent["status"],
  };
}

function toObservation(row: ObservationRow): AttendanceSourceObservation {
  return {
    id: row.id,
    projectId: row.projectId,
    source: row.source as AttendanceSource,
    windowId: row.windowId,
    operationalDate: row.operationalDate,
    observedAt: row.observedAt.toISOString(),
    observedCount: row.observedCount,
    expectedCount: row.expectedCount,
    confidence: row.confidence,
    coverage: row.coverage as CoverageLevel,
    health: row.health as DeviceHealthStatus,
    note: row.note,
  };
}

function toCalculation(
  row: CalculationRow,
  project: { code: string; name: string },
): AttendanceCalculation {
  return {
    id: row.id,
    projectId: row.projectId,
    projectCode: project.code,
    projectName: project.name,
    windowId: row.windowId,
    operationalDate: row.operationalDate,
    expected: row.expected,
    present: row.present,
    absent: row.absent,
    unknown: row.unknown,
    sourceCounts: (row.sourceCounts ?? {}) as Record<AttendanceSource, number>,
    coverage: row.coverage as CoverageLevel,
    dataQuality: row.dataQuality as DataQualityLevel,
    freshness: row.freshness?.toISOString() ?? null,
    policy: row.policy ?? {},
    computedAt: row.computedAt.toISOString(),
  };
}

/** Facility identity attached to a calculation row, so the API discloses it. */
interface CalculationProjectRef {
  code: string;
  name: string;
}

function toDq(row: DqRow): AttendanceDataQuality {
  return {
    id: row.id,
    projectId: row.projectId,
    source: row.source as AttendanceSource,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    coverage: row.coverage as CoverageLevel,
    freshness: row.freshness?.toISOString() ?? null,
    duplicateRate: row.duplicateRate,
    invalidCount: row.invalidCount,
    unmatchedCount: row.unmatchedCount,
    health: row.health as DeviceHealthStatus,
    assessedAt: row.assessedAt.toISOString(),
  };
}

function toGroup(row: GroupRow): AttendanceAnomalyGroup {
  return {
    id: row.id,
    projectId: row.projectId,
    populationId: row.populationId,
    anomalyType: row.anomalyType as AttendanceAnomalyType,
    state: row.state as AttendanceAnomalyState,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

function toAnomaly(row: AnomalyRow & { projectCode: string | null; projectName: string | null; districtId: string | null }): AttendanceAnomaly {
  return {
    id: row.id,
    projectId: row.projectId,
    populationId: row.populationId,
    windowId: row.windowId,
    operationalDate: row.operationalDate,
    observationStart: row.observationStart.toISOString(),
    observationEnd: row.observationEnd.toISOString(),
    anomalyType: row.anomalyType as AttendanceAnomalyType,
    score: row.score,
    severity: row.severity as AttendanceAnomalySeverity,
    confidence: row.confidence,
    dataQuality: row.dataQuality as DataQualityLevel,
    detectorVersion: row.detectorVersion,
    supportingSignals: row.supportingSignals ?? {},
    state: row.state as AttendanceAnomalyState,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNotes: row.reviewNotes,
    groupId: row.groupId,
    linkedInspectionId: row.linkedInspectionId,
    linkedComplaintId: row.linkedComplaintId,
    sourceData: row.sourceData ?? {},
    createdAt: row.createdAt.toISOString(),
    projectCode: row.projectCode,
    projectName: row.projectName,
    districtId: row.districtId,
  };
}

function toReviewAction(row: ReviewActionRow): AttendanceReviewActionRecord {
  return {
    id: row.id,
    anomalyId: row.anomalyId,
    actorUserId: row.actorUserId,
    action: row.action as AttendanceReviewActionRecord["action"],
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCorrection(row: CorrectionRow): AttendanceCorrection {
  return {
    id: row.id,
    projectId: row.projectId,
    targetType: row.targetType,
    targetId: row.targetId,
    field: row.field,
    originalValue: row.originalValue ?? {},
    newValue: row.newValue ?? {},
    reason: row.reason,
    requestedBy: row.requestedBy,
    status: row.status as AttendanceCorrectionStatus,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toExport(row: ExportRow): AttendanceExport {
  return {
    id: row.id,
    projectId: row.projectId,
    requestedBy: row.requestedBy,
    scope: row.scope ?? {},
    status: row.status as AttendanceExportStatus,
    format: row.format as AttendanceExport["format"],
    artifactKey: row.artifactKey,
    recordCount: row.recordCount,
    requestedAt: row.requestedAt.toISOString(),
    generatedAt: row.generatedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    downloadedAt: row.downloadedAt?.toISOString() ?? null,
    error: row.error,
  };
}

/* ---------- Write types ---------- */

export interface RawTransactionWrite {
  deviceId: string;
  externalUserId: string;
  deviceEventId: string | null;
  occurredAt: Date;
  rawType: string;
  payload: Record<string, unknown> | null;
  syncCursor: string | null;
}

export interface NormalizedEventWrite {
  id: string;
  projectId: string;
  deviceId: string;
  populationId: string | null;
  personExternalId: string;
  netramUserId: string | null;
  eventType: AttendanceEventType;
  occurredAt: Date;
  rawTransactionId: string;
  windowId: string | null;
  operationalDate: string | null;
  dedupKey: string | null;
}

export interface AnomalyWrite {
  id: string;
  projectId: string;
  populationId: string | null;
  windowId: string | null;
  operationalDate: string | null;
  observationStart: Date;
  observationEnd: Date;
  anomalyType: AttendanceAnomalyType;
  score: number;
  severity: AttendanceAnomalySeverity;
  confidence: number;
  dataQuality: DataQualityLevel;
  detectorVersion: string;
  supportingSignals: Record<string, unknown>;
  sourceData: Record<string, unknown>;
  groupId: string | null;
}

export interface AttendanceAuditWrite {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  resourceType: string;
  resourceId: string;
}

export interface AttendanceEventWrite {
  type: DomainEventType;
  correlationId: string;
  actorUserId: string | null;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
}

export interface AttendanceAnomalyListFilter {
  projectId?: string;
  type?: string;
  severity?: string;
  state?: string;
  from?: string;
  to?: string;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

export interface AttendanceCalculationListFilter {
  projectId?: string;
  windowId?: string;
  from?: string;
  to?: string;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

/**
 * Persistence for the attendance subsystem. Raw + normalized source data and
 * configuration are authoritative; window summaries and anomalies are derived
 * (regenerable). All mutation+audit+outbox operations are atomic.
 */
export class AttendanceRepository {
  constructor(private db: DrizzleDB) {}

  /* ---------- Devices ---------- */

  async upsertDevice(device: {
    id?: string;
    projectId: string;
    name: string;
    provider: string;
    deviceExternalId: string;
  }): Promise<AttendanceDevice> {
    const rows = await this.db
      .insert(devicesTable)
      .values(device)
      .onConflictDoUpdate({
        target: [devicesTable.projectId, devicesTable.deviceExternalId],
        set: { name: device.name, provider: device.provider },
      })
      .returning();
    return toDevice(rows[0]!);
  }

  async updateDeviceHealth(
    id: string,
    update: {
      status: DeviceHealthStatus;
      lastSeenAt?: Date;
      lastEventAt?: Date;
      syncCursor?: string | null;
    },
  ): Promise<void> {
    await this.db.update(devicesTable).set(update).where(eq(devicesTable.id, id));
  }

  async findDeviceById(id: string): Promise<AttendanceDevice | null> {
    const rows = await this.db.select().from(devicesTable).where(eq(devicesTable.id, id)).limit(1);
    return rows[0] ? toDevice(rows[0]) : null;
  }

  async listDevices(filter: { projectId?: string; jurisdictionIds?: string[] }): Promise<
    Array<AttendanceDevice & { projectCode: string; projectName: string; districtId: string | null }>
  > {
    const scope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;
    const projectCond = filter.projectId ? eq(devicesTable.projectId, filter.projectId) : undefined;
    const rows = await this.db
      .select({
        device: devicesTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
      })
      .from(devicesTable)
      .innerJoin(projectsTable, eq(devicesTable.projectId, projectsTable.id))
      .where(and(projectCond, scope))
      .orderBy(desc(devicesTable.createdAt));
    return rows.map((r) => ({
      ...toDevice(r.device),
      projectCode: r.projectCode,
      projectName: r.projectName,
      districtId: r.districtId,
    }));
  }

  /* ---------- Populations / windows / config ---------- */

  async listPopulations(projectId: string): Promise<AttendancePopulation[]> {
    const rows = await this.db
      .select()
      .from(populationsTable)
      .where(eq(populationsTable.projectId, projectId))
      .orderBy(populationsTable.code);
    return rows.map(toPopulation);
  }

  async listPopulationMembers(populationId: string): Promise<MemberRow[]> {
    return this.db
      .select()
      .from(membersTable)
      .where(eq(membersTable.populationId, populationId));
  }

  async listWindows(projectId: string): Promise<AttendanceWindow[]> {
    const rows = await this.db
      .select()
      .from(windowsTable)
      .where(eq(windowsTable.projectId, projectId))
      .orderBy(windowsTable.startTime);
    return rows.map(toWindow);
  }

  async findWindowById(id: string): Promise<AttendanceWindow | null> {
    const rows = await this.db.select().from(windowsTable).where(eq(windowsTable.id, id)).limit(1);
    return rows[0] ? toWindow(rows[0]) : null;
  }

  async getConfig(projectId: string | null): Promise<AttendanceConfig | null> {
    if (projectId) {
      const rows = await this.db
        .select()
        .from(configsTable)
        .where(eq(configsTable.projectId, projectId))
        .limit(1);
      if (rows[0]) return toConfig(rows[0]);
    }
    const defaults = await this.db
      .select()
      .from(configsTable)
      .where(isNull(configsTable.projectId))
      .limit(1);
    return defaults[0] ? toConfig(defaults[0]) : null;
  }

  async upsertConfig(config: {
    projectId: string | null;
    dayStartTime: string;
    thresholds: AttendanceConfig["thresholds"];
    baseline: AttendanceConfig["baseline"];
    retention: AttendanceConfig["retention"];
  }): Promise<AttendanceConfig> {
    const rows = await this.db
      .insert(configsTable)
      .values({
        ...config,
        thresholds: config.thresholds as never,
        baseline: config.baseline as never,
        retention: config.retention as never,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: configsTable.projectId,
        set: {
          dayStartTime: config.dayStartTime,
          thresholds: config.thresholds as never,
          baseline: config.baseline as never,
          retention: config.retention as never,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toConfig(rows[0]!);
  }

  /* ---------- Identity mappings ---------- */

  async findIdentityMapping(
    deviceId: string,
    externalUserId: string,
  ): Promise<IdentityMappingRow | null> {
    const rows = await this.db
      .select()
      .from(identityMappingsTable)
      .where(
        and(
          eq(identityMappingsTable.deviceId, deviceId),
          eq(identityMappingsTable.externalUserId, externalUserId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async createIdentityMapping(mapping: {
    projectId: string;
    deviceId: string;
    externalUserId: string;
    personExternalId: string;
    netramUserId: string | null;
  }): Promise<IdentityMappingRow> {
    const rows = await this.db.insert(identityMappingsTable).values(mapping).returning();
    return rows[0]!;
  }

  async listIdentityMappings(filter: { projectId: string; page: number; pageSize: number }): Promise<{
    items: IdentityMappingRow[];
    total: number;
  }> {
    const where = eq(identityMappingsTable.projectId, filter.projectId);
    const [rows, count] = await Promise.all([
      this.db
        .select()
        .from(identityMappingsTable)
        .where(where)
        .orderBy(desc(identityMappingsTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(identityMappingsTable)
        .where(where),
    ]);
    return { items: rows, total: count[0]?.count ?? 0 };
  }

  /* ---------- Raw transactions ---------- */

  /** Inserts raw transactions; duplicates on (device, device_event_id) are skipped. */
  async insertRawTransactions(txs: RawTransactionWrite[]): Promise<AttendanceRawTransaction[]> {
    if (txs.length === 0) return [];
    const rows = await this.db
      .insert(rawTransactionsTable)
      .values(txs.map((t) => ({ ...t, payload: t.payload as never })))
      .onConflictDoNothing()
      .returning();
    return rows.map(toRawTransaction);
  }

  async updateRawTransaction(
    id: string,
    update: { status?: RawTransactionStatus; mappingStatus?: string | null; error?: string | null },
  ): Promise<void> {
    await this.db.update(rawTransactionsTable).set(update).where(eq(rawTransactionsTable.id, id));
  }

  async findRawTransactionById(id: string): Promise<AttendanceRawTransaction | null> {
    const rows = await this.db
      .select()
      .from(rawTransactionsTable)
      .where(eq(rawTransactionsTable.id, id))
      .limit(1);
    return rows[0] ? toRawTransaction(rows[0]) : null;
  }

  async listRecentRawTransactions(
    deviceId: string,
    limit = 200,
  ): Promise<AttendanceRawTransaction[]> {
    const rows = await this.db
      .select()
      .from(rawTransactionsTable)
      .where(eq(rawTransactionsTable.deviceId, deviceId))
      .orderBy(desc(rawTransactionsTable.occurredAt))
      .limit(limit);
    return rows.map(toRawTransaction);
  }

  /* ---------- Normalized events ---------- */

  async insertEvents(events: NormalizedEventWrite[]): Promise<void> {
    if (events.length === 0) return;
    await this.db.insert(eventsTable).values(events.map((e) => ({ ...e })));
  }

  async listEventsForCalculation(
    projectId: string,
    windowId: string,
    operationalDate: string,
  ): Promise<EventRow[]> {
    return this.db
      .select()
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.projectId, projectId),
          eq(eventsTable.windowId, windowId),
          eq(eventsTable.operationalDate, operationalDate),
        ),
      );
  }

  async listEventsForBaseline(
    projectId: string,
    operationalDateFrom: string,
    operationalDateTo: string,
  ): Promise<EventRow[]> {
    return this.db
      .select()
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.projectId, projectId),
          gte(eventsTable.operationalDate, operationalDateFrom),
          lte(eventsTable.operationalDate, operationalDateTo),
        ),
      );
  }

  async listEventsForPerson(
    projectId: string,
    personExternalId: string,
    opts: { windowId?: string; operationalDate?: string; from?: string; to?: string } = {},
  ): Promise<
    Array<EventRow & { deviceName: string | null; windowCode: string | null }>
  > {
    const conditions = [
      eq(eventsTable.projectId, projectId),
      eq(eventsTable.personExternalId, personExternalId),
    ];
    if (opts.windowId) conditions.push(eq(eventsTable.windowId, opts.windowId));
    if (opts.operationalDate) conditions.push(eq(eventsTable.operationalDate, opts.operationalDate));
    if (opts.from) conditions.push(gte(eventsTable.operationalDate, opts.from));
    if (opts.to) conditions.push(lte(eventsTable.operationalDate, opts.to));

    const rows = await this.db
      .select({
        event: eventsTable,
        deviceName: devicesTable.name,
        windowCode: windowsTable.code,
      })
      .from(eventsTable)
      .innerJoin(devicesTable, eq(eventsTable.deviceId, devicesTable.id))
      .leftJoin(windowsTable, eq(eventsTable.windowId, windowsTable.id))
      .where(and(...conditions))
      .orderBy(eventsTable.occurredAt);
    return rows.map((r) => ({ ...r.event, deviceName: r.deviceName, windowCode: r.windowCode }));
  }

  /* ---------- Source observations ---------- */

  async insertSourceObservation(o: {
    id: string;
    projectId: string;
    source: AttendanceSource;
    windowId: string | null;
    operationalDate: string;
    observedAt: Date;
    observedCount: number | null;
    expectedCount: number | null;
    confidence: number | null;
    coverage: CoverageLevel;
    health: DeviceHealthStatus;
    note: string | null;
  }): Promise<AttendanceSourceObservation> {
    const rows = await this.db.insert(observationsTable).values(o).returning();
    return toObservation(rows[0]!);
  }

  async listSourceObservations(
    filter: { projectId: string; from?: string; to?: string },
  ): Promise<AttendanceSourceObservation[]> {
    const conditions = [eq(observationsTable.projectId, filter.projectId)];
    if (filter.from) conditions.push(gte(observationsTable.operationalDate, filter.from));
    if (filter.to) conditions.push(lte(observationsTable.operationalDate, filter.to));
    const rows = await this.db
      .select()
      .from(observationsTable)
      .where(and(...conditions))
      .orderBy(desc(observationsTable.observedAt));
    return rows.map(toObservation);
  }

  async findSourceObservation(
    projectId: string,
    source: AttendanceSource,
    windowId: string | null,
    operationalDate: string,
  ): Promise<AttendanceSourceObservation | null> {
    const rows = await this.db
      .select()
      .from(observationsTable)
      .where(
        and(
          eq(observationsTable.projectId, projectId),
          eq(observationsTable.source, source),
          eq(observationsTable.operationalDate, operationalDate),
          windowId ? eq(observationsTable.windowId, windowId) : isNull(observationsTable.windowId),
        ),
      )
      .limit(1);
    return rows[0] ? toObservation(rows[0]) : null;
  }

  /* ---------- Calculations ---------- */

  async upsertCalculation(c: {
    projectId: string;
    windowId: string;
    operationalDate: string;
    expected: number | null;
    present: number;
    absent: number | null;
    unknown: number;
    sourceCounts: Record<string, number>;
    coverage: CoverageLevel;
    dataQuality: DataQualityLevel;
    freshness: Date | null;
    policy: Record<string, unknown>;
  }): Promise<AttendanceCalculation> {
    const rows = await this.db
      .insert(calculationsTable)
      .values({
        ...c,
        sourceCounts: c.sourceCounts as never,
        policy: c.policy as never,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [calculationsTable.projectId, calculationsTable.windowId, calculationsTable.operationalDate],
        set: {
          expected: c.expected,
          present: c.present,
          absent: c.absent,
          unknown: c.unknown,
          sourceCounts: c.sourceCounts as never,
          coverage: c.coverage,
          dataQuality: c.dataQuality,
          freshness: c.freshness,
          policy: c.policy as never,
          computedAt: new Date(),
        },
      })
      .returning();
    return toCalculation(rows[0]!, await this.projectRef(rows[0]!.projectId));
  }

  /** Facility identity for calculations whose query has no projects join. */
  private async projectRef(projectId: string): Promise<CalculationProjectRef> {
    const rows = await this.db
      .select({ code: projectsTable.code, name: projectsTable.name })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);
    return rows[0] ?? { code: "—", name: "Unknown facility" };
  }

  async listCalculations(filter: AttendanceCalculationListFilter): Promise<{
    items: AttendanceCalculation[];
    total: number;
  }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.projectId) conditions.push(eq(calculationsTable.projectId, filter.projectId));
    if (filter.windowId) conditions.push(eq(calculationsTable.windowId, filter.windowId));
    if (filter.from) conditions.push(gte(calculationsTable.operationalDate, filter.from));
    if (filter.to) conditions.push(lte(calculationsTable.operationalDate, filter.to));
    const where = and(...conditions);

    const scope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;

    const [rows, count] = await Promise.all([
      this.db
        .select({
          calc: calculationsTable,
          projectCode: projectsTable.code,
          projectName: projectsTable.name,
        })
        .from(calculationsTable)
        .innerJoin(projectsTable, eq(calculationsTable.projectId, projectsTable.id))
        .where(and(where, scope))
        .orderBy(desc(calculationsTable.computedAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(calculationsTable)
        .innerJoin(projectsTable, eq(calculationsTable.projectId, projectsTable.id))
        .where(and(where, scope)),
    ]);
    return {
      items: rows.map((r) =>
        toCalculation(r.calc as unknown as CalculationRow, {
          code: r.projectCode,
          name: r.projectName,
        }),
      ),
      total: count[0]?.count ?? 0,
    };
  }

  async findCalculationById(id: string): Promise<AttendanceCalculation | null> {
    const rows = await this.db
      .select()
      .from(calculationsTable)
      .where(eq(calculationsTable.id, id))
      .limit(1);
    return rows[0] ? toCalculation(rows[0], await this.projectRef(rows[0].projectId)) : null;
  }

  async updateCalculationDerived(
    id: string,
    update: { present?: number; absent?: number | null; unknown?: number },
  ): Promise<AttendanceCalculation | null> {
    const rows = await this.db
      .update(calculationsTable)
      .set({ ...update, computedAt: new Date() })
      .where(eq(calculationsTable.id, id))
      .returning();
    return rows[0] ? toCalculation(rows[0], await this.projectRef(rows[0].projectId)) : null;
  }

  /** All calculations matching scope/filters (unpaginated) — for CSV exports. */
  async listAllCalculations(filter: {
    projectId?: string;
    jurisdictionIds?: string[];
    from?: string;
    to?: string;
  }): Promise<AttendanceCalculation[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.projectId) conditions.push(eq(calculationsTable.projectId, filter.projectId));
    if (filter.from) conditions.push(gte(calculationsTable.operationalDate, filter.from));
    if (filter.to) conditions.push(lte(calculationsTable.operationalDate, filter.to));
    const scope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;
    const rows = await this.db
      .select({
        calc: calculationsTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
      })
      .from(calculationsTable)
      .innerJoin(projectsTable, eq(calculationsTable.projectId, projectsTable.id))
      .where(and(and(...conditions), scope))
      .orderBy(desc(calculationsTable.operationalDate));
    return rows.map((r) =>
      toCalculation(r.calc as unknown as CalculationRow, {
        code: r.projectCode,
        name: r.projectName,
      }),
    );
  }

  /** Aggregate-first overview rows: latest calculations + project context. */
  async listOverview(filter: {
    jurisdictionIds?: string[];
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    items: Array<
      AttendanceCalculation & {
        projectCode: string;
        projectName: string;
        districtId: string | null;
      }
    >;
    total: number;
  }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.from) conditions.push(gte(calculationsTable.operationalDate, filter.from));
    if (filter.to) conditions.push(lte(calculationsTable.operationalDate, filter.to));
    const scope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;
    const where = and(and(...conditions), scope);

    const [rows, count] = await Promise.all([
      this.db
        .select({
          calc: calculationsTable,
          projectCode: projectsTable.code,
          projectName: projectsTable.name,
          districtId: projectsTable.districtId,
        })
        .from(calculationsTable)
        .innerJoin(projectsTable, eq(calculationsTable.projectId, projectsTable.id))
        .where(where)
        .orderBy(desc(calculationsTable.computedAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(calculationsTable)
        .innerJoin(projectsTable, eq(calculationsTable.projectId, projectsTable.id))
        .where(where),
    ]);
    return {
      items: rows.map((r) => ({
        ...toCalculation(r.calc as unknown as CalculationRow, {
          code: r.projectCode,
          name: r.projectName,
        }),
        districtId: r.districtId,
      })),
      total: count[0]?.count ?? 0,
    };
  }

  /** Open anomaly count per project (aggregate-first monitoring). */
  async countOpenAnomaliesByProject(filter: {
    jurisdictionIds?: string[];
  }): Promise<Array<{ projectId: string; count: number }>> {
    const scope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;
    const rows = await this.db
      .select({
        projectId: anomaliesTable.projectId,
        count: sql<number>`count(*)::int`,
      })
      .from(anomaliesTable)
      .innerJoin(projectsTable, eq(anomaliesTable.projectId, projectsTable.id))
      .where(and(inArray(anomaliesTable.state, ["NEW", "REVIEWED", "INVESTIGATING"]), scope))
      .groupBy(anomaliesTable.projectId);
    return rows;
  }

  async findEventById(id: string): Promise<AttendanceEvent | null> {
    const rows = await this.db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    return rows[0] ? toEvent(rows[0]) : null;
  }

  async findLatestCalculation(projectId: string): Promise<AttendanceCalculation | null> {
    const rows = await this.db
      .select()
      .from(calculationsTable)
      .where(eq(calculationsTable.projectId, projectId))
      .orderBy(desc(calculationsTable.computedAt))
      .limit(1);
    return rows[0] ? toCalculation(rows[0], await this.projectRef(rows[0].projectId)) : null;
  }

  async listHistoricalPresent(
    projectId: string,
    windowId: string,
    from: string,
    to: string,
  ): Promise<Array<{ operationalDate: string; present: number; expected: number | null }>> {
    const rows = await this.db
      .select({
        operationalDate: calculationsTable.operationalDate,
        present: calculationsTable.present,
        expected: calculationsTable.expected,
      })
      .from(calculationsTable)
      .where(
        and(
          eq(calculationsTable.projectId, projectId),
          eq(calculationsTable.windowId, windowId),
          gte(calculationsTable.operationalDate, from),
          lte(calculationsTable.operationalDate, to),
        ),
      )
      .orderBy(calculationsTable.operationalDate);
    return rows;
  }

  /* ---------- Data quality ---------- */

  async insertDataQuality(dq: {
    projectId: string;
    source: AttendanceSource;
    periodStart: Date;
    periodEnd: Date;
    coverage: CoverageLevel;
    freshness: Date | null;
    duplicateRate: number | null;
    invalidCount: number;
    unmatchedCount: number;
    health: DeviceHealthStatus;
  }): Promise<AttendanceDataQuality> {
    const rows = await this.db.insert(dqTable).values(dq).returning();
    return toDq(rows[0]!);
  }

  async findLatestDataQuality(
    projectId: string,
    source: AttendanceSource,
    from: Date,
    to: Date,
  ): Promise<AttendanceDataQuality | null> {
    const rows = await this.db
      .select()
      .from(dqTable)
      .where(
        and(
          eq(dqTable.projectId, projectId),
          eq(dqTable.source, source),
          gte(dqTable.periodEnd, from),
          lte(dqTable.periodEnd, to),
        ),
      )
      .orderBy(desc(dqTable.assessedAt))
      .limit(1);
    return rows[0] ? toDq(rows[0]) : null;
  }

  /* ---------- Anomaly groups ---------- */

  async updateGroupState(
    id: string,
    state: AttendanceAnomalyState,
    closedAt: Date | null,
  ): Promise<void> {
    await this.db.update(groupsTable).set({ state, closedAt }).where(eq(groupsTable.id, id));
  }

  async findOpenGroup(
    projectId: string,
    populationId: string | null,
    anomalyType: AttendanceAnomalyType,
  ): Promise<AttendanceAnomalyGroup | null> {
    const rows = await this.db
      .select()
      .from(groupsTable)
      .where(
        and(
          eq(groupsTable.projectId, projectId),
          eq(groupsTable.anomalyType, anomalyType),
          populationId ? eq(groupsTable.populationId, populationId) : isNull(groupsTable.populationId),
          eq(groupsTable.state, "NEW"),
        ),
      )
      .limit(1);
    return rows[0] ? toGroup(rows[0]) : null;
  }

  async createGroup(g: {
    id: string;
    projectId: string;
    populationId: string | null;
    anomalyType: AttendanceAnomalyType;
  }): Promise<AttendanceAnomalyGroup> {
    const rows = await this.db
      .insert(groupsTable)
      .values({ ...g, state: "NEW", openedAt: new Date() })
      .returning();
    return toGroup(rows[0]!);
  }

  /* ---------- Anomalies ---------- */

  private anomalyBaseJoin() {
    return this.db
      .select({
        anomaly: anomaliesTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
      })
      .from(anomaliesTable)
      .innerJoin(projectsTable, eq(anomaliesTable.projectId, projectsTable.id));
  }

  async insertAnomaly(a: AnomalyWrite): Promise<AttendanceAnomaly> {
    const inserted = await this.db
      .insert(anomaliesTable)
      .values({
        ...a,
        state: "NEW",
        supportingSignals: a.supportingSignals as never,
        sourceData: a.sourceData as never,
      })
      .returning();
    const full = await this.findById(inserted[0]!.id);
    return full!;
  }

  async findById(id: string): Promise<AttendanceAnomaly | null> {
    const rows = await this.anomalyBaseJoin().where(eq(anomaliesTable.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return toAnomaly({
      ...r.anomaly,
      projectCode: r.projectCode,
      projectName: r.projectName,
      districtId: r.districtId,
    } as unknown as AnomalyRow & { projectCode: string | null; projectName: string | null; districtId: string | null });
  }

  async listAnomalies(filter: AttendanceAnomalyListFilter): Promise<{
    items: AttendanceAnomaly[];
    total: number;
  }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.projectId) conditions.push(eq(anomaliesTable.projectId, filter.projectId));
    if (filter.type) conditions.push(eq(anomaliesTable.anomalyType, filter.type));
    if (filter.severity) conditions.push(eq(anomaliesTable.severity, filter.severity));
    if (filter.state) conditions.push(eq(anomaliesTable.state, filter.state));
    if (filter.from) conditions.push(gte(anomaliesTable.operationalDate, filter.from));
    if (filter.to) conditions.push(lte(anomaliesTable.operationalDate, filter.to));
    const where = and(...conditions);
    const scope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;

    const [rows, count] = await Promise.all([
      this.anomalyBaseJoin()
        .where(and(where, scope))
        .orderBy(desc(anomaliesTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(anomaliesTable)
        .innerJoin(projectsTable, eq(anomaliesTable.projectId, projectsTable.id))
        .where(and(where, scope)),
    ]);
    return {
      items: rows.map((r) =>
        toAnomaly({
          ...r.anomaly,
          projectCode: r.projectCode,
          projectName: r.projectName,
          districtId: r.districtId,
        } as unknown as AnomalyRow & { projectCode: string | null; projectName: string | null; districtId: string | null }),
      ),
      total: count[0]?.count ?? 0,
    };
  }

  async findOpenAnomalyFor(
    projectId: string,
    windowId: string | null,
    operationalDate: string | null,
    anomalyType: AttendanceAnomalyType,
  ): Promise<AttendanceAnomaly | null> {
    const rows = await this.anomalyBaseJoin()
      .where(
        and(
          eq(anomaliesTable.projectId, projectId),
          eq(anomaliesTable.anomalyType, anomalyType),
          windowId ? eq(anomaliesTable.windowId, windowId) : isNull(anomaliesTable.windowId),
          operationalDate ? eq(anomaliesTable.operationalDate, operationalDate) : isNull(anomaliesTable.operationalDate),
          inArray(anomaliesTable.state, ["NEW", "REVIEWED", "INVESTIGATING"]),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return toAnomaly({
      ...r.anomaly,
      projectCode: r.projectCode,
      projectName: r.projectName,
      districtId: r.districtId,
    } as unknown as AnomalyRow & { projectCode: string | null; projectName: string | null; districtId: string | null });
  }

  /** Recomputes an unreviewed (NEW) anomaly in place + audit + outbox (§33). */
  async recalculateAnomaly(cmd: {
    anomalyId: string;
    score: number;
    severity: AttendanceAnomalySeverity;
    confidence: number;
    dataQuality: DataQualityLevel;
    supportingSignals: Record<string, unknown>;
    sourceData: Record<string, unknown>;
    observationEnd: Date;
    audit: AttendanceAuditWrite;
    event: AttendanceEventWrite;
  }): Promise<AttendanceAnomaly> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(anomaliesTable)
        .set({
          score: cmd.score,
          severity: cmd.severity,
          confidence: cmd.confidence,
          dataQuality: cmd.dataQuality,
          supportingSignals: cmd.supportingSignals as never,
          sourceData: cmd.sourceData as never,
          observationEnd: cmd.observationEnd,
        })
        .where(eq(anomaliesTable.id, cmd.anomalyId));
      await tx.insert(auditEvents).values({
        action: cmd.audit.auditAction,
        actorUserId: cmd.audit.actorUserId,
        resourceType: cmd.audit.resourceType,
        resourceId: cmd.audit.resourceId,
        requestId: cmd.audit.requestId,
        ipAddress: cmd.audit.ipAddress,
        metadata: cmd.audit.auditMetadata,
      });
      await tx.insert(outboxEvents).values({
        type: cmd.event.type,
        correlationId: cmd.event.correlationId,
        actorUserId: cmd.event.actorUserId,
        resourceType: cmd.event.resourceType,
        resourceId: cmd.event.resourceId,
        payload: cmd.event.payload as never,
      });
    });
    return (await this.findById(cmd.anomalyId))!;
  }

  /** Updates an anomaly and atomically records audit + outbox + review action. */
  async transitionAnomaly(cmd: {
    anomalyId: string;
    to: AttendanceAnomalyState;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewNotes: string | null;
    linkedInspectionId?: string | null;
    linkedComplaintId?: string | null;
    groupId?: string | null;
    reviewAction: AttendanceReviewActionRecord["action"];
    audit: AttendanceAuditWrite;
    event: AttendanceEventWrite;
  }): Promise<AttendanceAnomaly> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(anomaliesTable)
        .set({
          state: cmd.to,
          reviewedBy: cmd.reviewedBy,
          reviewedAt: cmd.reviewedAt,
          reviewNotes: cmd.reviewNotes,
          linkedInspectionId: cmd.linkedInspectionId ?? null,
          linkedComplaintId: cmd.linkedComplaintId ?? null,
          groupId: cmd.groupId ?? null,
        })
        .where(eq(anomaliesTable.id, cmd.anomalyId));

      await tx.insert(auditEvents).values({
        action: cmd.audit.auditAction,
        actorUserId: cmd.audit.actorUserId,
        resourceType: cmd.audit.resourceType,
        resourceId: cmd.audit.resourceId,
        requestId: cmd.audit.requestId,
        ipAddress: cmd.audit.ipAddress,
        metadata: cmd.audit.auditMetadata,
      });

      await tx.insert(outboxEvents).values({
        type: cmd.event.type,
        correlationId: cmd.event.correlationId,
        actorUserId: cmd.event.actorUserId,
        resourceType: cmd.event.resourceType,
        resourceId: cmd.event.resourceId,
        payload: cmd.event.payload as never,
      });

      if (cmd.reviewedBy) {
        await tx.insert(reviewActionsTable).values({
          anomalyId: cmd.anomalyId,
          actorUserId: cmd.reviewedBy,
          action: cmd.reviewAction,
          note: cmd.reviewNotes,
        });
      }
    });
    return (await this.findById(cmd.anomalyId))!;
  }

  /* ---------- Review actions ---------- */

  async listReviewActions(anomalyId: string): Promise<AttendanceReviewActionRecord[]> {
    const rows = await this.db
      .select()
      .from(reviewActionsTable)
      .where(eq(reviewActionsTable.anomalyId, anomalyId))
      .orderBy(reviewActionsTable.createdAt);
    return rows.map(toReviewAction);
  }

  /* ---------- Corrections ---------- */

  async insertCorrection(c: {
    id: string;
    projectId: string;
    targetType: string;
    targetId: string;
    field: string;
    originalValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reason: string;
    requestedBy: string;
  }): Promise<AttendanceCorrection> {
    const rows = await this.db
      .insert(correctionsTable)
      .values({
        ...c,
        originalValue: c.originalValue as never,
        newValue: c.newValue as never,
        status: "PENDING",
      })
      .returning();
    return toCorrection(rows[0]!);
  }

  async listCorrections(filter: { projectId: string; status?: string }): Promise<AttendanceCorrection[]> {
    const rows = await this.db
      .select()
      .from(correctionsTable)
      .where(
        and(
          eq(correctionsTable.projectId, filter.projectId),
          filter.status ? eq(correctionsTable.status, filter.status) : undefined,
        ),
      )
      .orderBy(desc(correctionsTable.createdAt));
    return rows.map(toCorrection);
  }

  async findCorrectionById(id: string): Promise<AttendanceCorrection | null> {
    const rows = await this.db
      .select()
      .from(correctionsTable)
      .where(eq(correctionsTable.id, id))
      .limit(1);
    return rows[0] ? toCorrection(rows[0]) : null;
  }

  async updateCorrectionStatus(
    id: string,
    status: AttendanceCorrectionStatus,
    approvedBy: string | null,
  ): Promise<AttendanceCorrection | null> {
    const rows = await this.db
      .update(correctionsTable)
      .set({ status, approvedBy, approvedAt: status === "PENDING" ? null : new Date() })
      .where(eq(correctionsTable.id, id))
      .returning();
    return rows[0] ? toCorrection(rows[0]) : null;
  }

  /* ---------- Exports ---------- */

  async insertExport(e: {
    id: string;
    projectId: string;
    requestedBy: string;
    scope: Record<string, unknown>;
    format: "csv";
  }): Promise<AttendanceExport> {
    const rows = await this.db
      .insert(exportsTable)
      .values({ ...e, scope: e.scope as never, status: "REQUESTED" })
      .returning();
    return toExport(rows[0]!);
  }

  async findExportById(id: string): Promise<AttendanceExport | null> {
    const rows = await this.db.select().from(exportsTable).where(eq(exportsTable.id, id)).limit(1);
    return rows[0] ? toExport(rows[0]) : null;
  }

  async updateExport(
    id: string,
    update: {
      status?: AttendanceExportStatus;
      artifactKey?: string | null;
      recordCount?: number | null;
      generatedAt?: Date | null;
      expiresAt?: Date | null;
      downloadedAt?: Date | null;
      error?: string | null;
    },
  ): Promise<void> {
    await this.db.update(exportsTable).set(update).where(eq(exportsTable.id, id));
  }

  async listExports(filter: { projectId: string }): Promise<AttendanceExport[]> {
    const rows = await this.db
      .select()
      .from(exportsTable)
      .where(eq(exportsTable.projectId, filter.projectId))
      .orderBy(desc(exportsTable.requestedAt));
    return rows.map(toExport);
  }

  /** Stores the CSV artifact for a completed export (called by the export worker). */
  async generateExportArtifact(cmd: {
    exportId: string;
    csv: string;
    recordCount: number;
    actorUserId: string;
    requestId: string | null;
    ipAddress: string | null;
  }): Promise<void> {
    const artifactKey = `attendance-exports/${cmd.exportId}.csv`;
    await this.db
      .update(exportsTable)
      .set({
        status: "READY",
        artifactKey,
        recordCount: cmd.recordCount,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
        error: null,
      })
      .where(eq(exportsTable.id, cmd.exportId));
  }

  /** Marks READY exports whose expiry has passed as EXPIRED. Returns count. */
  async expireExports(now: Date): Promise<number> {
    const expired = await this.db
      .select({ id: exportsTable.id })
      .from(exportsTable)
      .where(and(eq(exportsTable.status, "READY"), lte(exportsTable.expiresAt, now)));
    if (expired.length === 0) return 0;
    await this.db
      .update(exportsTable)
      .set({ status: "EXPIRED" })
      .where(
        inArray(
          exportsTable.id,
          expired.map((r) => r.id),
        ),
      );
    return expired.length;
  }

  /* ---------- Audit + outbox helpers (non-transactional callers) ---------- */

  async recordAudit(write: AttendanceAuditWrite): Promise<void> {
    await this.db.insert(auditEvents).values({
      action: write.auditAction,
      actorUserId: write.actorUserId,
      resourceType: write.resourceType,
      resourceId: write.resourceId,
      requestId: write.requestId,
      ipAddress: write.ipAddress,
      metadata: write.auditMetadata,
    });
  }

  async enqueueEvent(write: AttendanceEventWrite): Promise<void> {
    await this.db.insert(outboxEvents).values({
      type: write.type,
      correlationId: write.correlationId,
      actorUserId: write.actorUserId,
      resourceType: write.resourceType,
      resourceId: write.resourceId,
      payload: write.payload as never,
    });
  }

  /**
   * Pending corrections across the caller's jurisdiction (Action Inbox,
   * AGENTS.md §16-§17). The caller's corrections endpoint is project-scoped;
   * the inbox needs a cross-project, jurisdiction-scoped read so approvers see
   * every pending correction they could lawfully decide on. Joins the project
   * for name/district context.
   */
  async listPendingCorrections(jurisdictionIds?: string[]): Promise<
    (AttendanceCorrection & {
      projectCode: string | null;
      projectName: string | null;
      districtId: string | null;
      requesterName: string | null;
    })[]
  > {
    const rows = await this.db
      .select({
        correction: correctionsTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
        requesterName: usersTable.displayName,
      })
      .from(correctionsTable)
      .innerJoin(projectsTable, eq(correctionsTable.projectId, projectsTable.id))
      .leftJoin(usersTable, eq(correctionsTable.requestedBy, usersTable.id))
      .where(
        and(
          eq(correctionsTable.status, "PENDING"),
          jurisdictionIds?.length
            ? inArray(projectsTable.districtId, jurisdictionIds)
            : undefined,
        ),
      )
      .orderBy(desc(correctionsTable.createdAt))
      .limit(100);
    return rows.map((r) => ({
      ...toCorrection(r.correction as CorrectionRow),
      projectCode: r.projectCode,
      projectName: r.projectName,
      districtId: r.districtId,
      requesterName: r.requesterName,
    }));
  }

  async projectDistrictId(projectId: string): Promise<string | null> {
    const rows = await this.db
      .select({ districtId: projectsTable.districtId })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);
    return rows[0]?.districtId ?? null;
  }
}