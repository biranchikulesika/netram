import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  aiAnomalies as aiAnomaliesTable,
  inspections as inspectionsTable,
  projects as projectsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { AIAnomaly, AnomalyStatus, AuditAction, DomainEventType } from "@netram/types";

export interface AiAnomalyRow {
  id: string;
  inspectionId: string;
  evidenceId: string | null;
  type: AIAnomaly["type"];
  severity: AIAnomaly["severity"];
  confidence: number;
  modelVersion: string | null;
  explanation: string | null;
  status: AnomalyStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  projectCode: string | null;
  projectName: string | null;
  districtId: string | null;
}

export function toAiAnomaly(row: AiAnomalyRow): AIAnomaly {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    evidenceId: row.evidenceId,
    type: row.type,
    severity: row.severity,
    confidence: row.confidence,
    modelVersion: row.modelVersion,
    explanation: row.explanation,
    status: row.status,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    projectCode: row.projectCode,
    projectName: row.projectName,
    districtId: row.districtId,
  };
}

export interface AiAnomalyWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface TransitionAiAnomalyWrite extends AiAnomalyWriteContext {
  anomalyId: string;
  to: AnomalyStatus;
  reviewedBy: string;
  reviewedAt: Date;
}

export interface AiAnomalyListFilter {
  type?: string;
  severity?: string;
  status?: AnomalyStatus;
  inspectionId?: string;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

/**
 * Persistence for advisory AI anomaly alerts (§36). District context comes
 * from anomaly -> inspection -> project. Mutations plus audit/outbox atomic.
 */
export class AiAnomalyRepository {
  constructor(private db: DrizzleDB) {}

  private baseJoin() {
    return this.db
      .select({
        anomaly: aiAnomaliesTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
      })
      .from(aiAnomaliesTable)
      .innerJoin(inspectionsTable, eq(aiAnomaliesTable.inspectionId, inspectionsTable.id))
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id));
  }

  async list(filter: AiAnomalyListFilter): Promise<{ items: AIAnomaly[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.type) conditions.push(eq(aiAnomaliesTable.type, filter.type));
    if (filter.severity) conditions.push(eq(aiAnomaliesTable.severity, filter.severity));
    if (filter.status) conditions.push(eq(aiAnomaliesTable.status, filter.status));
    if (filter.inspectionId)
      conditions.push(eq(aiAnomaliesTable.inspectionId, filter.inspectionId));
    const where = and(...conditions);

    const scope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;
    const scoped = and(where, scope);

    const [rows, count] = await Promise.all([
      this.baseJoin()
        .where(scoped)
        .orderBy(desc(aiAnomaliesTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiAnomaliesTable)
        .innerJoin(inspectionsTable, eq(aiAnomaliesTable.inspectionId, inspectionsTable.id))
        .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
        .where(scoped),
    ]);

    const items = rows.map((r) =>
      toAiAnomaly({
        ...r.anomaly,
        projectCode: r.projectCode,
        projectName: r.projectName,
        districtId: r.districtId,
      } as unknown as AiAnomalyRow),
    );
    return { items, total: count[0]?.count ?? 0 };
  }

  async findById(id: string): Promise<AIAnomaly | null> {
    const rows = await this.baseJoin().where(eq(aiAnomaliesTable.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return toAiAnomaly({
      ...r.anomaly,
      projectCode: r.projectCode,
      projectName: r.projectName,
      districtId: r.districtId,
    } as unknown as AiAnomalyRow);
  }

  async transitionWithAuditAndEvent(cmd: TransitionAiAnomalyWrite): Promise<AIAnomaly> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(aiAnomaliesTable)
        .set({
          status: cmd.to,
          reviewedBy: cmd.reviewedBy,
          reviewedAt: cmd.reviewedAt,
        })
        .where(eq(aiAnomaliesTable.id, cmd.anomalyId));

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "ai-anomaly",
        resourceId: cmd.anomalyId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.anomalyId,
        actorUserId: cmd.actorUserId,
        resourceType: "ai-anomaly",
        resourceId: cmd.anomalyId,
        payload: { ...cmd.eventPayload, status: cmd.to },
      });
    });

    // Response carries the joined project/district context; read post-commit.
    return (await this.findById(cmd.anomalyId))!;
  }
}
