import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  correctiveActions as correctiveActionsTable,
  correctiveActionFiles as correctiveActionFilesTable,
  findings as findingsTable,
  inspections as inspectionsTable,
  projects as projectsTable,
  findingCategories as findingCategoriesTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  CorrectiveAction,
  CorrectiveActionFile,
  CorrectiveActionStatus,
  FindingSeverity,
} from "@netram/types";
import type { FindingWriteContext } from "./finding.repository.js";

export interface CorrectiveActionRow {
  id: string;
  findingId: string;
  inspectionId: string;
  organisationId: string | null;
  status: CorrectiveActionStatus;
  deadline: Date | null;
  submittedAt: Date | null;
  actionSummary: string | null;
  verifiedAt: Date | null;
  verifiedByUserId: string | null;
  reviewRemarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrectiveActionFileRow {
  id: string;
  correctiveActionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  storageKey: string;
  createdAt: Date;
}

export function toCorrectiveActionFile(row: CorrectiveActionFileRow): CorrectiveActionFile {
  return {
    id: row.id,
    correctiveActionId: row.correctiveActionId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface CorrectiveActionProjectRow {
  id: string;
  code: string;
  name: string;
  districtId: string | null;
  description: string | null;
}

export interface CorrectiveActionFindingRow {
  id: string;
  severity: FindingSeverity;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
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
    actionSummary: row.actionSummary,
    atrFiles: [],
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    verifiedByUserId: row.verifiedByUserId,
    reviewRemarks: row.reviewRemarks,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: null,
    finding: null,
  };
}

export interface CreateCorrectiveActionWrite extends FindingWriteContext {
  id: string;
  findingId: string;
  inspectionId: string;
  organisationId: string | null;
  deadline: Date | string | null;
}

export interface CorrectiveActionWorkWrite extends FindingWriteContext {
  correctiveActionId: string;
  to: CorrectiveActionStatus;
  note: string | null;
  /** ATR content supplied on the submit step (docs/DoSJE.md §16). */
  actionSummary?: string | null;
  /** Attachments lodged with the ATR; replaces any earlier submission's files. */
  files?: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    contentHash: string;
    storageKey: string;
  }[];
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
        .select({
          ca: correctiveActionsTable,
          project: {
            id: projectsTable.id,
            code: projectsTable.code,
            name: projectsTable.name,
            districtId: projectsTable.districtId,
            description: projectsTable.description,
          },
          finding: {
            id: findingsTable.id,
            severity: findingsTable.severity,
            description: findingsTable.description,
            categoryId: findingsTable.categoryId,
            categoryName: findingCategoriesTable.name,
          },
        })
        .from(correctiveActionsTable)
        .innerJoin(inspectionsTable, eq(correctiveActionsTable.inspectionId, inspectionsTable.id))
        .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
        .innerJoin(findingsTable, eq(correctiveActionsTable.findingId, findingsTable.id))
        .leftJoin(findingCategoriesTable, eq(findingsTable.categoryId, findingCategoriesTable.id))
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
      items: rows.map((r) => ({
        ...toCorrectiveAction(r.ca as unknown as CorrectiveActionRow),
        project: {
          id: r.project.id,
          code: r.project.code,
          name: r.project.name,
          districtId: r.project.districtId,
          description: r.project.description,
        },
        finding: {
          id: r.finding.id,
          severity: r.finding.severity as FindingSeverity,
          description: r.finding.description,
          categoryId: r.finding.categoryId,
          categoryName: r.finding.categoryName,
        },
      })),
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
      atrFiles: await this.listFiles(id),
      districtId: row.districtId,
    };
  }

  async listFiles(correctiveActionId: string): Promise<CorrectiveActionFile[]> {
    const rows = await this.db
      .select()
      .from(correctiveActionFilesTable)
      .where(eq(correctiveActionFilesTable.correctiveActionId, correctiveActionId))
      .orderBy(correctiveActionFilesTable.createdAt);
    return rows.map((r) => toCorrectiveActionFile(r as unknown as CorrectiveActionFileRow));
  }

  async findFileById(id: string): Promise<{
    file: CorrectiveActionFile;
    correctiveActionId: string;
    storageKey: string;
  } | null> {
    const rows = await this.db
      .select()
      .from(correctiveActionFilesTable)
      .where(eq(correctiveActionFilesTable.id, id))
      .limit(1);
    const row = rows[0] as unknown as CorrectiveActionFileRow | undefined;
    if (!row) return null;
    return {
      file: toCorrectiveActionFile(row),
      correctiveActionId: row.correctiveActionId,
      storageKey: row.storageKey,
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

  /**
   * Persists a corrective action whose status is set as a byproduct of
   * recorded work (ATR submission or authority review) (§32). There is no
   * manual status transition.
   */
  async applyWorkWithAuditAndEvent(
    cmd: CorrectiveActionWorkWrite,
  ): Promise<CorrectiveActionWithDistrict> {
    const current = await this.findById(cmd.correctiveActionId);
    if (!current) throw new Error("corrective action missing");

    const transitioned: CorrectiveAction = await this.db.transaction(async (tx) => {
      const submittedAt =
        cmd.to === "submitted"
          ? new Date()
          : current.submittedAt
            ? new Date(current.submittedAt)
            : null;
      const rows = await tx
        .update(correctiveActionsTable)
        .set({
          status: cmd.to,
          submittedAt,
          // ATR content arrives with the institution's submission step.
          actionSummary: cmd.actionSummary ?? current.actionSummary,
          // Verification stamp arrives with the authority accept decision.
          verifiedAt:
            cmd.to === "accepted"
              ? new Date()
              : current.verifiedAt
                ? new Date(current.verifiedAt)
                : null,
          verifiedByUserId:
            cmd.to === "accepted" ? cmd.actorUserId : current.verifiedByUserId,
          reviewRemarks: cmd.note ?? current.reviewRemarks,
          updatedAt: new Date(),
        })
        .where(eq(correctiveActionsTable.id, cmd.correctiveActionId))
        .returning();
      const row = rows[0]!;

      // ATR submission replaces the previous submission's attachments; the
      // storage blobs of the old submission are left orphaned (mirrors how
      // evidence handles re-uploads) but DB metadata is atomic with the status.
      if (cmd.files) {
        await tx
          .delete(correctiveActionFilesTable)
          .where(eq(correctiveActionFilesTable.correctiveActionId, cmd.correctiveActionId));
        if (cmd.files.length > 0) {
          await tx.insert(correctiveActionFilesTable).values(
            cmd.files.map((f) => ({
              id: f.id,
              correctiveActionId: cmd.correctiveActionId,
              fileName: f.fileName,
              mimeType: f.mimeType,
              sizeBytes: f.sizeBytes,
              contentHash: f.contentHash,
              storageKey: f.storageKey,
            })),
          );
        }
      }

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
    return {
      ...transitioned,
      atrFiles: await this.listFiles(cmd.correctiveActionId),
      districtId: current.districtId,
    };
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
