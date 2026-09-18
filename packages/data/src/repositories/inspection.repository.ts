import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  projects as projectsTable,
  inspections as inspectionsTable,
  inspectionAssignments,
  disclosurePolicies,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import { RepositoryNotFoundError } from "./errors.js";
import type {
  AuditAction,
  DomainEventType,
  Inspection,
  InspectionStatus,
  InspectionType,
  InspectionTrigger,
} from "@netram/types";

export interface InspectionRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  districtId: string | null;
  templateId: string | null;
  type: InspectionType;
  trigger: InspectionTrigger;
  status: InspectionStatus;
  disclosurePolicyId: string | null;
  disclosureRuleType: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toInspection(row: InspectionRow, assignedUserIds: string[]): Inspection {
  return {
    id: row.id,
    projectId: row.projectId,
    projectCode: row.projectCode,
    projectName: row.projectName,
    districtId: row.districtId,
    templateId: row.templateId,
    type: row.type,
    trigger: row.trigger,
    status: row.status,
    disclosurePolicyId: row.disclosurePolicyId,
    disclosureRuleType: row.disclosureRuleType,
    scheduledStart: row.scheduledStart ? row.scheduledStart.toISOString() : null,
    scheduledEnd: row.scheduledEnd ? row.scheduledEnd.toISOString() : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    assignedUserIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadAssignedUserIds<TDb extends { select: DrizzleDB["select"] }>(
  db: TDb,
  inspectionId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: inspectionAssignments.userId })
    .from(inspectionAssignments)
    .where(eq(inspectionAssignments.inspectionId, inspectionId));
  return rows.map((r) => r.userId);
}

export interface InspectionListFilter {
  status?: InspectionStatus;
  type?: InspectionType;
  projectId?: string;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

export class InspectionRepository {
  constructor(private db: DrizzleDB) {}

  private async enrich(rows: InspectionRow[]): Promise<Inspection[]> {
    return Promise.all(
      rows.map((r) => loadAssignedUserIds(this.db, r.id).then((ids) => toInspection(r, ids))),
    );
  }

  async findById(id: string): Promise<Inspection | null> {
    const rows = await this.db
      .select({
        id: inspectionsTable.id,
        projectId: inspectionsTable.projectId,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
        templateId: inspectionsTable.templateId,
        type: inspectionsTable.type,
        trigger: inspectionsTable.trigger,
        status: inspectionsTable.status,
        disclosurePolicyId: inspectionsTable.disclosurePolicyId,
        disclosureRuleType: disclosurePolicies.ruleType,
        scheduledStart: inspectionsTable.scheduledStart,
        scheduledEnd: inspectionsTable.scheduledEnd,
        startedAt: inspectionsTable.startedAt,
        submittedAt: inspectionsTable.submittedAt,
        createdAt: inspectionsTable.createdAt,
        updatedAt: inspectionsTable.updatedAt,
      })
      .from(inspectionsTable)
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
      .leftJoin(disclosurePolicies, eq(inspectionsTable.disclosurePolicyId, disclosurePolicies.id))
      .where(eq(inspectionsTable.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return (await this.enrich([row as unknown as InspectionRow]))[0]!;
  }

  async list(filter: InspectionListFilter): Promise<{ items: Inspection[]; total: number }> {
    const conditions = [];
    if (filter.status) conditions.push(eq(inspectionsTable.status, filter.status));
    if (filter.type) conditions.push(eq(inspectionsTable.type, filter.type));
    if (filter.projectId) conditions.push(eq(inspectionsTable.projectId, filter.projectId));
    if (filter.jurisdictionIds && filter.jurisdictionIds.length > 0) {
      conditions.push(inArray(projectsTable.districtId, filter.jurisdictionIds));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, count] = await Promise.all([
      this.db
        .select({
          id: inspectionsTable.id,
          projectId: inspectionsTable.projectId,
          projectCode: projectsTable.code,
          projectName: projectsTable.name,
          districtId: projectsTable.districtId,
          templateId: inspectionsTable.templateId,
          type: inspectionsTable.type,
          trigger: inspectionsTable.trigger,
          status: inspectionsTable.status,
          disclosurePolicyId: inspectionsTable.disclosurePolicyId,
          disclosureRuleType: disclosurePolicies.ruleType,
          scheduledStart: inspectionsTable.scheduledStart,
          scheduledEnd: inspectionsTable.scheduledEnd,
          startedAt: inspectionsTable.startedAt,
          submittedAt: inspectionsTable.submittedAt,
          createdAt: inspectionsTable.createdAt,
          updatedAt: inspectionsTable.updatedAt,
        })
        .from(inspectionsTable)
        .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
        .leftJoin(
          disclosurePolicies,
          eq(inspectionsTable.disclosurePolicyId, disclosurePolicies.id),
        )
        .where(where)
        .orderBy(desc(inspectionsTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(inspectionsTable)
        .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
        .where(where),
    ]);

    return {
      items: await this.enrich(rows as unknown as InspectionRow[]),
      total: count[0]?.count ?? 0,
    };
  }

  /** Creates an inspection + any assignments and writes audit + outbox in the same transaction. */
  async createWithAuditAndEvent(cmd: CreateInspectionWrite): Promise<Inspection> {
    const created: Inspection = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(inspectionsTable)
        .values({
          id: cmd.id,
          projectId: cmd.projectId,
          templateId: cmd.templateId,
          disclosurePolicyId: cmd.disclosurePolicyId,
          type: cmd.type,
          trigger: cmd.trigger,
          status: "assigned",
          scheduledStart: cmd.scheduledStart ? new Date(cmd.scheduledStart) : null,
          scheduledEnd: cmd.scheduledEnd ? new Date(cmd.scheduledEnd) : null,
        })
        .returning();
      const row = rows[0]!;

      const project = await tx
        .select({
          code: projectsTable.code,
          name: projectsTable.name,
          districtId: projectsTable.districtId,
          disclosureRuleType: disclosurePolicies.ruleType,
        })
        .from(projectsTable)
        .leftJoin(
          disclosurePolicies,
          row.disclosurePolicyId ? eq(disclosurePolicies.id, row.disclosurePolicyId) : sql`false`,
        )
        .where(eq(projectsTable.id, cmd.projectId))
        .limit(1);
      const proj = project[0]!;

      if (cmd.assigneeUserIds.length > 0) {
        await tx
          .insert(inspectionAssignments)
          .values(
            cmd.assigneeUserIds.map((userId) => ({
              inspectionId: cmd.id,
              userId,
              role: "lead",
              status: "assigned",
            })),
          )
          .onConflictDoNothing();
      }

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection",
        resourceId: cmd.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata, type: cmd.type },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.id,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection",
        resourceId: cmd.id,
        payload: {
          ...cmd.eventPayload,
          inspectionId: cmd.id,
          status: "assigned",
        },
      });

      return toInspection(
        {
          ...(row as unknown as InspectionRow),
          projectId: cmd.projectId,
          projectCode: proj.code,
          projectName: proj.name,
          districtId: proj.districtId,
          disclosureRuleType: proj.disclosureRuleType ?? null,
        },
        cmd.assigneeUserIds,
      );
    });
    return created;
  }

  async transitionWithAuditAndEvent(cmd: TransitionInspectionWrite): Promise<Inspection> {
    const cursor = await this.db
      .select()
      .from(inspectionsTable)
      .where(eq(inspectionsTable.id, cmd.inspectionId))
      .limit(1);
    if (cursor.length === 0) throw new RepositoryNotFoundError("Inspection");

    const upstream = await this.db
      .select({
        projectId: inspectionsTable.projectId,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
        templateId: inspectionsTable.templateId,
        disclosurePolicyId: inspectionsTable.disclosurePolicyId,
        disclosureRuleType: disclosurePolicies.ruleType,
        type: inspectionsTable.type,
        trigger: inspectionsTable.trigger,
        createdAt: inspectionsTable.createdAt,
        updatedAt: inspectionsTable.updatedAt,
      })
      .from(inspectionsTable)
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
      .leftJoin(disclosurePolicies, eq(inspectionsTable.disclosurePolicyId, disclosurePolicies.id))
      .where(eq(inspectionsTable.id, cmd.inspectionId))
      .limit(1);
    if (upstream.length === 0) throw new RepositoryNotFoundError("Inspection");

    const previous = upstream[0]!;

    const startedAt = cmd.to === "in_progress" ? new Date() : cursor[0]!.startedAt;
    const submittedAt = cmd.to === "submitted" ? new Date() : cursor[0]!.submittedAt;

    const transitioned: Inspection = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(inspectionsTable)
        .set({ status: cmd.to, startedAt, submittedAt, updatedAt: new Date() })
        .where(eq(inspectionsTable.id, cmd.inspectionId))
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection",
        resourceId: cmd.inspectionId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata, type: row.type },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.inspectionId,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection",
        resourceId: cmd.inspectionId,
        payload: {
          ...cmd.eventPayload,
          inspectionId: cmd.inspectionId,
          to: cmd.to,
        },
      });

      return toInspection(
        {
          ...(previous as unknown as InspectionRow),
          id: row.id,
          status: row.status as InspectionStatus,
          startedAt: row.startedAt,
          submittedAt: row.submittedAt,
          scheduledStart: row.scheduledStart,
          scheduledEnd: row.scheduledEnd,
          updatedAt: row.updatedAt,
        },
        await loadAssignedUserIds(tx, cmd.inspectionId),
      );
    });
    return transitioned;
  }

  /**
   * Identifies inspections past their scheduledEnd in pre-submission statuses
   * and emits InspectionOverdue domain events to the outbox (§26, §29).
   * Does not alter inspection status; the outbox drives authority notification.
   */
  async markOverdueInspections(actorUserId: string | null = null): Promise<{
    count: number;
    inspectionIds: string[];
  }> {
    const overdueStatuses = ["assigned", "scheduled", "in_progress"] as const;
    const now = new Date();

    const overdue = await this.db
      .select({ id: inspectionsTable.id })
      .from(inspectionsTable)
      .where(
        and(
          inArray(inspectionsTable.status, [...overdueStatuses]),
          lt(inspectionsTable.scheduledEnd, now),
        ),
      );

    if (overdue.length === 0) return { count: 0, inspectionIds: [] };

    const ids = overdue.map((r) => r.id);

    await this.db.transaction(async (tx) => {
      await tx.insert(auditEvents).values(
        ids.map((id) => ({
          action: "inspection.overdue" as const,
          actorUserId,
          resourceType: "inspection",
          resourceId: id,
          requestId: null,
          ipAddress: null,
          metadata: { detectedAt: now.toISOString() },
        })),
      );

      await tx.insert(outboxEvents).values(
        ids.map((id) => ({
          type: "inspection.overdue" as const,
          correlationId: id,
          actorUserId,
          resourceType: "inspection",
          resourceId: id,
          payload: { inspectionId: id, detectedAt: now.toISOString() },
        })),
      );
    });

    return { count: ids.length, inspectionIds: ids };
  }
}


export interface CreateInspectionWrite {
  id: string;
  projectId: string;
  templateId: string | null;
  disclosurePolicyId: string | null;
  type: InspectionType;
  trigger: InspectionTrigger;
  scheduledStart: string | Date | null;
  scheduledEnd: string | Date | null;
  assigneeUserIds: string[];
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface TransitionInspectionWrite {
  inspectionId: string;
  to: InspectionStatus;
  note: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}
