import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  aiAnomalies as aiAnomaliesTable,
  inspections as inspectionsTable,
  inspectionAssignments,
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
  projectId: string | null;
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
    projectId: row.projectId,
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
  /**
   * When escalating to `investigated`, the follow-up inspection to create in
   * the same transaction. Absent for every other status change.
   */
  followUpInspection?: FollowUpInspectionWrite;
}

/** Follow-up inspection created by an AI-anomaly escalation (§36 → §32). */
export interface FollowUpInspectionWrite {
  id: string;
  projectId: string;
  assignmentId: string;
  /** Officer recorded as lead of the follow-up inspection. */
  leadUserId: string | null;
}

export interface AiAnomalyListFilter {
  type?: string;
  severity?: string;
  status?: AnomalyStatus;
  inspectionId?: string;
  projectId?: string;
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
        projectId: projectsTable.id,
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
    if (filter.projectId)
      conditions.push(eq(projectsTable.id, filter.projectId));
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
        projectId: r.projectId,
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
      projectId: r.projectId,
      projectCode: r.projectCode,
      projectName: r.projectName,
      districtId: r.districtId,
    } as unknown as AiAnomalyRow);
  }

  /**
   * Transitions an anomaly and, when escalating to investigation, creates the
   * follow-up inspection and its lead assignment in the SAME transaction, so
   * the escalation is atomic: status + inspection + assignment + audit + outbox
   * all commit together or not at all.
   */
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

      if (cmd.followUpInspection) {
        const f = cmd.followUpInspection;
        await tx.insert(inspectionsTable).values({
          id: f.id,
          projectId: f.projectId,
          type: "follow_up",
          trigger: "automatic",
          status: "assigned",
        });

        if (f.leadUserId) {
          await tx.insert(inspectionAssignments).values({
            id: f.assignmentId,
            inspectionId: f.id,
            userId: f.leadUserId,
            role: "lead",
            status: "assigned",
          });
        }

        await tx.insert(auditEvents).values({
          action: "inspection.created",
          actorUserId: cmd.actorUserId,
          resourceType: "inspection",
          resourceId: f.id,
          requestId: cmd.requestId,
          ipAddress: cmd.ipAddress,
          metadata: {
            projectId: f.projectId,
            type: "follow_up",
            trigger: "automatic",
            sourceAnomalyId: cmd.anomalyId,
          },
        });

        await tx.insert(outboxEvents).values({
          type: "inspection.created",
          correlationId: f.id,
          actorUserId: cmd.actorUserId,
          resourceType: "inspection",
          resourceId: f.id,
          payload: {
            inspectionId: f.id,
            projectId: f.projectId,
            type: "follow_up",
            trigger: "automatic",
            sourceAnomalyId: cmd.anomalyId,
          },
        });

        if (f.leadUserId) {
          await tx.insert(outboxEvents).values({
            type: "inspection.assigned",
            correlationId: f.id,
            actorUserId: f.leadUserId,
            resourceType: "inspection",
            resourceId: f.id,
            payload: {
              inspectionId: f.id,
              userId: f.leadUserId,
              role: "lead",
              sourceAnomalyId: cmd.anomalyId,
            },
          });
        }
      }

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
