import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  projectRiskSnapshots as snapshotsTable,
  projects as projectsTable,
  districts as districtsTable,
  organisations as organisationsTable,
  inspections as inspectionsTable,
  inspectionFlags as flagsTable,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  ProjectRiskSnapshot,
  ProjectRankEntry,
  ProjectRiskRankingQuery,
  ProjectRiskSnapshotQuery,
  CompositeRiskLevel,
  RiskContributor,
} from "@netram/types";

export interface InsertProjectRiskSnapshotParams {
  projectId: string;
  calculatedAt?: Date;
  scoringVersion: string;
  totalScore: number;
  riskLevel: CompositeRiskLevel;
  financialScore: number;
  inspectionQualityScore: number;
  attendanceAnomalyScore: number;
  complaintDensityScore: number;
  aiAnomalyScore: number;
  financialSignals?: Record<string, unknown>;
  inspectionQualitySignals?: Record<string, unknown>;
  attendanceAnomalySignals?: Record<string, unknown>;
  complaintDensitySignals?: Record<string, unknown>;
  aiAnomalySignals?: Record<string, unknown>;
  topContributors?: RiskContributor[];
  explanation: string;
  inspectionFlagId?: string | null;
  scheduledInspectionId?: string | null;
}

export function toProjectRiskSnapshot(
  row: typeof snapshotsTable.$inferSelect,
): ProjectRiskSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    calculatedAt:
      row.calculatedAt instanceof Date ? row.calculatedAt.toISOString() : String(row.calculatedAt),
    scoringVersion: row.scoringVersion,
    totalScore: row.totalScore,
    riskLevel: row.riskLevel as CompositeRiskLevel,
    financialScore: row.financialScore,
    inspectionQualityScore: row.inspectionQualityScore,
    attendanceAnomalyScore: row.attendanceAnomalyScore,
    complaintDensityScore: row.complaintDensityScore,
    aiAnomalyScore: row.aiAnomalyScore,
    financialSignals: row.financialSignals ?? {},
    inspectionQualitySignals: row.inspectionQualitySignals ?? {},
    attendanceAnomalySignals: row.attendanceAnomalySignals ?? {},
    complaintDensitySignals: row.complaintDensitySignals ?? {},
    aiAnomalySignals: row.aiAnomalySignals ?? {},
    topContributors: (row.topContributors ?? []) as unknown as RiskContributor[],
    explanation: row.explanation,
    inspectionFlagId: row.inspectionFlagId ?? null,
    scheduledInspectionId: row.scheduledInspectionId ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export class ProjectRiskRepository {
  constructor(private readonly db: DrizzleDB) {}

  async insertSnapshot(
    params: InsertProjectRiskSnapshotParams,
    tx?: DrizzleDB,
  ): Promise<ProjectRiskSnapshot> {
    const client = tx ?? this.db;
    const [row] = await client
      .insert(snapshotsTable)
      .values({
        projectId: params.projectId,
        calculatedAt: params.calculatedAt ?? new Date(),
        scoringVersion: params.scoringVersion,
        totalScore: params.totalScore,
        riskLevel: params.riskLevel,
        financialScore: params.financialScore,
        inspectionQualityScore: params.inspectionQualityScore,
        attendanceAnomalyScore: params.attendanceAnomalyScore,
        complaintDensityScore: params.complaintDensityScore,
        aiAnomalyScore: params.aiAnomalyScore,
        financialSignals: params.financialSignals ?? {},
        inspectionQualitySignals: params.inspectionQualitySignals ?? {},
        attendanceAnomalySignals: params.attendanceAnomalySignals ?? {},
        complaintDensitySignals: params.complaintDensitySignals ?? {},
        aiAnomalySignals: params.aiAnomalySignals ?? {},
        topContributors: (params.topContributors ?? []) as unknown as Array<
          Record<string, unknown>
        >,
        explanation: params.explanation,
        inspectionFlagId: params.inspectionFlagId ?? null,
        scheduledInspectionId: params.scheduledInspectionId ?? null,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to insert project risk snapshot");
    }
    return toProjectRiskSnapshot(row);
  }

  async findLatestByProject(projectId: string): Promise<ProjectRiskSnapshot | null> {
    const rows = await this.db
      .select()
      .from(snapshotsTable)
      .where(eq(snapshotsTable.projectId, projectId))
      .orderBy(desc(snapshotsTable.calculatedAt))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return toProjectRiskSnapshot(rows[0]);
  }

  async findRecentSnapshots(query: ProjectRiskSnapshotQuery): Promise<ProjectRiskSnapshot[]> {
    const conditions = [eq(snapshotsTable.projectId, query.projectId)];

    if (query.startDate) {
      conditions.push(gte(snapshotsTable.calculatedAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(snapshotsTable.calculatedAt, new Date(query.endDate)));
    }

    const limit = query.limit ?? 20;

    const rows = await this.db
      .select()
      .from(snapshotsTable)
      .where(and(...conditions))
      .orderBy(desc(snapshotsTable.calculatedAt))
      .limit(limit);

    return rows.map(toProjectRiskSnapshot);
  }

  /**
   * Returns active projects ranked by their latest Composite Risk Score (descending).
   */
  async listRanked(
    query: ProjectRiskRankingQuery,
  ): Promise<{ items: ProjectRankEntry[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    // Use distinct on project_id ordering by calculated_at desc to get latest snapshot per project
    // Or subquery latest snapshot id per project
    const latestSnapshotSubquery = this.db
      .select({
        projectId: snapshotsTable.projectId,
        maxCalculatedAt: sql<Date>`max(${snapshotsTable.calculatedAt})`.as("max_calculated_at"),
      })
      .from(snapshotsTable)
      .groupBy(snapshotsTable.projectId)
      .as("latest_calc");

    // Open inspections subquery: inspections with status NOT IN ('completed', 'rejected', 'cancelled')
    const openInspectionsSubquery = this.db
      .select({
        projectId: inspectionsTable.projectId,
        openCount: sql<number>`count(*)::int`.as("open_count"),
      })
      .from(inspectionsTable)
      .where(sql`${inspectionsTable.status} NOT IN ('completed', 'rejected', 'cancelled')`)
      .groupBy(inspectionsTable.projectId)
      .as("open_insp");

    // Open flags subquery: inspection_flags with status NOT IN ('resolved', 'dismissed')
    const openFlagsSubquery = this.db
      .select({
        projectId: flagsTable.projectId,
        flagCount: sql<number>`count(*)::int`.as("flag_count"),
      })
      .from(flagsTable)
      .where(sql`${flagsTable.status} NOT IN ('resolved', 'dismissed')`)
      .groupBy(flagsTable.projectId)
      .as("open_flg");

    const conditions = [sql`${projectsTable.status} = 'Active'`];

    if (query.districtId) {
      conditions.push(eq(projectsTable.districtId, query.districtId));
    }
    if (query.organisationId) {
      conditions.push(eq(projectsTable.organisationId, query.organisationId));
    }
    if (query.programmeId) {
      conditions.push(
        sql`${projectsTable.programmeIds}::jsonb @> ${JSON.stringify([query.programmeId])}::jsonb`,
      );
    }
    if (query.riskLevel) {
      conditions.push(eq(snapshotsTable.riskLevel, query.riskLevel));
    }
    if (query.minScore !== undefined) {
      conditions.push(gte(snapshotsTable.totalScore, query.minScore));
    }
    if (query.maxScore !== undefined) {
      conditions.push(lte(snapshotsTable.totalScore, query.maxScore));
    }

    const baseQuery = this.db
      .select({
        projectId: projectsTable.id,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
        districtName: districtsTable.name,
        organisationId: projectsTable.organisationId,
        organisationName: organisationsTable.name,
        totalScore: sql<number>`COALESCE(${snapshotsTable.totalScore}, 0)`,
        riskLevel: sql<string>`COALESCE(${snapshotsTable.riskLevel}, 'low')`,
        topContributors: snapshotsTable.topContributors,
        lastCalculatedAt: snapshotsTable.calculatedAt,
        scoringVersion: sql<string>`COALESCE(${snapshotsTable.scoringVersion}, 'project-risk-v1')`,
        openInspectionCount: sql<number>`COALESCE(${openInspectionsSubquery.openCount}, 0)`,
        hasOpenFlag: sql<boolean>`COALESCE(${openFlagsSubquery.flagCount}, 0) > 0`,
      })
      .from(projectsTable)
      .leftJoin(districtsTable, eq(projectsTable.districtId, districtsTable.id))
      .leftJoin(organisationsTable, eq(projectsTable.organisationId, organisationsTable.id))
      .leftJoin(latestSnapshotSubquery, eq(projectsTable.id, latestSnapshotSubquery.projectId))
      .leftJoin(
        snapshotsTable,
        and(
          eq(projectsTable.id, snapshotsTable.projectId),
          eq(snapshotsTable.calculatedAt, latestSnapshotSubquery.maxCalculatedAt),
        ),
      )
      .leftJoin(openInspectionsSubquery, eq(projectsTable.id, openInspectionsSubquery.projectId))
      .leftJoin(openFlagsSubquery, eq(projectsTable.id, openFlagsSubquery.projectId))
      .where(and(...conditions));

    // Count total matching
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .leftJoin(latestSnapshotSubquery, eq(projectsTable.id, latestSnapshotSubquery.projectId))
      .leftJoin(
        snapshotsTable,
        and(
          eq(projectsTable.id, snapshotsTable.projectId),
          eq(snapshotsTable.calculatedAt, latestSnapshotSubquery.maxCalculatedAt),
        ),
      )
      .where(and(...conditions));

    const total = countResult[0]?.count ?? 0;

    const rows = await baseQuery
      .orderBy(desc(sql`COALESCE(${snapshotsTable.totalScore}, 0)`), desc(projectsTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items: ProjectRankEntry[] = rows.map((r, idx) => ({
      rank: offset + idx + 1,
      projectId: r.projectId,
      projectCode: r.projectCode,
      projectName: r.projectName,
      districtId: r.districtId,
      districtName: r.districtName ?? null,
      programmeId: null,
      programmeName: null,
      organisationId: r.organisationId,
      organisationName: r.organisationName ?? null,
      totalScore: Number(r.totalScore),
      riskLevel: r.riskLevel as CompositeRiskLevel,
      topContributors: (r.topContributors ?? []) as unknown as RiskContributor[],
      lastCalculatedAt: r.lastCalculatedAt
        ? new Date(r.lastCalculatedAt).toISOString()
        : new Date().toISOString(),
      openInspectionCount: Number(r.openInspectionCount),
      hasOpenFlag: Boolean(r.hasOpenFlag),
      scoringVersion: r.scoringVersion,
    }));

    return { items, total };
  }

  async findAllActiveProjects(): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      districtId: string | null;
      organisationId: string | null;
    }>
  > {
    return this.db
      .select({
        id: projectsTable.id,
        code: projectsTable.code,
        name: projectsTable.name,
        districtId: projectsTable.districtId,
        organisationId: projectsTable.organisationId,
      })
      .from(projectsTable)
      .where(eq(projectsTable.status, "Active"));
  }

  async hasOpenInspection(projectId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: inspectionsTable.id })
      .from(inspectionsTable)
      .where(
        and(
          eq(inspectionsTable.projectId, projectId),
          sql`${inspectionsTable.status} NOT IN ('completed', 'rejected', 'cancelled')`,
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async getLastInspectionDates(projectId: string): Promise<{
    lastCompletedAt: Date | null;
    lastScheduledAt: Date | null;
  }> {
    const completedRows = await this.db
      .select({ submittedAt: inspectionsTable.submittedAt })
      .from(inspectionsTable)
      .where(
        and(eq(inspectionsTable.projectId, projectId), eq(inspectionsTable.status, "completed")),
      )
      .orderBy(desc(inspectionsTable.submittedAt))
      .limit(1);

    const scheduledRows = await this.db
      .select({ createdAt: inspectionsTable.createdAt })
      .from(inspectionsTable)
      .where(eq(inspectionsTable.projectId, projectId))
      .orderBy(desc(inspectionsTable.createdAt))
      .limit(1);

    return {
      lastCompletedAt: completedRows[0]?.submittedAt ?? null,
      lastScheduledAt: scheduledRows[0]?.createdAt ?? null,
    };
  }

  async findOpenFlag(projectId: string) {
    const rows = await this.db
      .select()
      .from(flagsTable)
      .where(
        and(
          eq(flagsTable.projectId, projectId),
          sql`${flagsTable.status} NOT IN ('resolved', 'dismissed')`,
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }
}
