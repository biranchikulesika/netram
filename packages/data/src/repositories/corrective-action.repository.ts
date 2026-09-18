import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  correctiveActions as correctiveActionsTable,
  findings as findingsTable,
  inspections as inspectionsTable,
  projects as projectsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import { RepositoryNotFoundError } from "./errors.js";
import type { CorrectiveAction, CorrectiveActionStatus } from "@netram/types";
import type { FindingWriteContext } from "./finding.repository.js";

export interface CorrectiveActionRow {
  id: string;
  findingId: string;
  inspectionId: string;
  organisationId: string | null;
  status: CorrectiveActionStatus;
  deadline: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrectiveActionWithDistrict extends CorrectiveAction {
  districtId: string | null;
}

export function toCorrectiveAction(row: CorrectiveActionRow): CorrectiveAction {
  return {
    id: row.id,
    findingId: row.findingId,
    inspectionId: row.inspectionId,
    organisationId: row.organisationId,
    status: row.status,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CreateCorrectiveActionWrite extends FindingWriteContext {
  id: string;
  findingId: string;
  inspectionId: string;
  organisationId: string | null;
  deadline: Date | string | null;
}

export interface TransitionCorrectiveActionWrite extends FindingWriteContext {
  correctiveActionId: string;
  to: CorrectiveActionStatus;
  note: string | null;
}

export interface CorrectiveActionListFilter {
  findingId?: string;
  inspectionId?: string;
  status?: CorrectiveActionStatus;
  organisationId?: string;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

/**
 * Persistence for corrective actions. Ordering one also moves the underlying
 * finding to `action_required`; a transition may advance the finding too. All
 * mutations plus audit and outbox are atomic.
 */
export class CorrectiveActionRepository {
  constructor(private db: DrizzleDB) {}

  async list(
    filter: CorrectiveActionListFilter,
  ): Promise<{ items: CorrectiveAction[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.findingId) conditions.push(eq(correctiveActionsTable.findingId, filter.findingId));
    if (filter.inspectionId)
      conditions.push(eq(correctiveActionsTable.inspectionId, filter.inspectionId));
    if (filter.status) conditions.push(eq(correctiveActionsTable.status, filter.status));
    if (filter.organisationId)
      conditions.push(eq(correctiveActionsTable.organisationId, filter.organisationId));
    const where = and(...conditions);

    const joinScope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;

    const [rows, count] = await Promise.all([
      this.db
        .select({ ca: correctiveActionsTable })
        .from(correctiveActionsTable)
        .innerJoin(inspectionsTable, eq(correctiveActionsTable.inspectionId, inspectionsTable.id))
        .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
        .where(and(where, joinScope))
        .orderBy(desc(correctiveActionsTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(correctiveActionsTable)
        .innerJoin(inspectionsTable, eq(correctiveActionsTable.inspectionId, inspectionsTable.id))
        .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
        .where(and(where, joinScope)),
    ]);

    return {
      items: rows.map((r) => toCorrectiveAction(r.ca as unknown as CorrectiveActionRow)),
      total: count[0]?.count ?? 0,
    };
  }

  async findById(id: string): Promise<CorrectiveActionWithDistrict | null> {
    const rows = await this.db
      .select({
        ca: correctiveActionsTable,
        districtId: projectsTable.districtId,
      })
      .from(correctiveActionsTable)
      .innerJoin(inspectionsTable, eq(correctiveActionsTable.inspectionId, inspectionsTable.id))
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
      .where(eq(correctiveActionsTable.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      ...toCorrectiveAction(row.ca as unknown as CorrectiveActionRow),
      districtId: row.districtId,
    };
  }

  async createWithAuditAndEvent(cmd: CreateCorrectiveActionWrite): Promise<CorrectiveAction> {
    const created: CorrectiveAction = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(correctiveActionsTable)
        .values({
          findingId: cmd.findingId,
          inspectionId: cmd.inspectionId,
          organisationId: cmd.organisationId,
          status: "pending",
          deadline: cmd.deadline ? new Date(cmd.deadline) : null,
        })
        .returning();
      const row = rows[0]!;

      const findingRows = await tx
        .update(findingsTable)
        .set({ status: "action_required", updatedAt: new Date() })
        .where(eq(findingsTable.id, cmd.findingId))
        .returning();
      const finding = findingRows[0];
      const previousStatus = finding?.status ?? "confirmed";

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "corrective_action",
        resourceId: row.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: {
          ...cmd.auditMetadata,
          findingId: cmd.findingId,
          inspectionId: cmd.inspectionId,
          organisationId: cmd.organisationId ?? null,
          findingStatus: "action_required",
          findingFrom: previousStatus,
        },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.findingId,
        actorUserId: cmd.actorUserId,
        resourceType: "corrective_action",
        resourceId: row.id,
        payload: {
          ...cmd.eventPayload,
          correctiveActionId: row.id,
          findingId: cmd.findingId,
          inspectionId: cmd.inspectionId,
          status: "pending",
        },
      });

      return toCorrectiveAction(row as unknown as CorrectiveActionRow);
    });
    return created;
  }

  async transitionWithAuditAndEvent(
    cmd: TransitionCorrectiveActionWrite,
  ): Promise<CorrectiveActionWithDistrict> {
    const current = await this.findById(cmd.correctiveActionId);
    if (!current) throw new RepositoryNotFoundError("CorrectiveAction");

    const transitioned: CorrectiveAction = await this.db.transaction(async (tx) => {
      const submittedAt =
        cmd.to === "submitted"
          ? new Date()
          : current.submittedAt
            ? new Date(current.submittedAt)
            : null;
      const rows = await tx
        .update(correctiveActionsTable)
        .set({ status: cmd.to, submittedAt, updatedAt: new Date() })
        .where(eq(correctiveActionsTable.id, cmd.correctiveActionId))
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "corrective_action",
        resourceId: cmd.correctiveActionId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: {
          ...cmd.auditMetadata,
          from: current.status,
          to: cmd.to,
          note: cmd.note ?? null,
        },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: current.findingId,
        actorUserId: cmd.actorUserId,
        resourceType: "corrective_action",
        resourceId: cmd.correctiveActionId,
        payload: {
          ...cmd.eventPayload,
          correctiveActionId: cmd.correctiveActionId,
          findingId: current.findingId,
          from: current.status,
          to: cmd.to,
        },
      });

      return toCorrectiveAction(row as unknown as CorrectiveActionRow);
    });
    return { ...transitioned, districtId: current.districtId };
  }

  /**
   * Scans for pending corrective actions whose deadline has passed (§26, §29)
   * and transitions them to 'overdue', generating audit records and outbox events atomically.
   */
  async markOverdueActions(actorUserId: string | null = null): Promise<{
    count: number;
    actionIds: string[];
  }> {
    const now = new Date();
    const candidates = await this.db
      .select({
        id: correctiveActionsTable.id,
        findingId: correctiveActionsTable.findingId,
        inspectionId: correctiveActionsTable.inspectionId,
        organisationId: correctiveActionsTable.organisationId,
        deadline: correctiveActionsTable.deadline,
      })
      .from(correctiveActionsTable)
      .where(
        and(
          eq(correctiveActionsTable.status, "pending"),
          lt(correctiveActionsTable.deadline, now),
        ),
      );

    if (candidates.length === 0) {
      return { count: 0, actionIds: [] };
    }

    const updatedIds: string[] = [];

    for (const ca of candidates) {
      await this.db.transaction(async (tx) => {
        await tx
          .update(correctiveActionsTable)
          .set({ status: "overdue", updatedAt: now })
          .where(eq(correctiveActionsTable.id, ca.id));

        await tx.insert(auditEvents).values({
          action: "corrective_action.overdue",
          actorUserId,
          resourceType: "corrective_action",
          resourceId: ca.id,
          requestId: null,
          ipAddress: null,
          metadata: {
            findingId: ca.findingId,
            inspectionId: ca.inspectionId,
            organisationId: ca.organisationId ?? null,
            deadline: ca.deadline ? ca.deadline.toISOString() : null,
            evaluatedAt: now.toISOString(),
            reason: "SLA deadline expired without submission",
          },
        });

        await tx.insert(outboxEvents).values({
          type: "corrective_action.overdue",
          correlationId: ca.findingId,
          actorUserId,
          resourceType: "corrective_action",
          resourceId: ca.id,
          payload: {
            correctiveActionId: ca.id,
            findingId: ca.findingId,
            inspectionId: ca.inspectionId,
            organisationId: ca.organisationId ?? null,
            deadline: ca.deadline ? ca.deadline.toISOString() : null,
          },
        });
      });
      updatedIds.push(ca.id);
    }

    return { count: updatedIds.length, actionIds: updatedIds };
  }
}
