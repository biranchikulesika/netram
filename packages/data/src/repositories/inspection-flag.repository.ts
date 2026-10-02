import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  inspectionFlags as flagsTable,
  projects as projectsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  InspectionFlag,
  InspectionFlagStatus,
  InspectionFlagRiskLevel,
  InspectionFlagTriggerSource,
  EvidenceRef,
  InspectionFlagListQuery,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface InspectionFlagRow {
  id: string;
  projectId: string;
  organisationId: string | null;
  allocationId: string | null;
  riskScore: number;
  riskLevel: InspectionFlagRiskLevel;
  triggerSource: InspectionFlagTriggerSource;
  explanation: string;
  evidenceRefs: EvidenceRef[];
  status: InspectionFlagStatus;
  assignedInspectorId: string | null;
  linkedInspectionId: string | null;
  reviewNotes: string | null;
  resolution: string | null;
  reviewerById: string | null;
  reviewedAt: Date | null;
  dismissedReason: string | null;
  dismissedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toInspectionFlag(row: InspectionFlagRow): InspectionFlag {
  return {
    id: row.id,
    projectId: row.projectId,
    organisationId: row.organisationId,
    allocationId: row.allocationId,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    triggerSource: row.triggerSource,
    explanation: row.explanation,
    evidenceRefs: row.evidenceRefs ?? [],
    status: row.status,
    assignedInspectorId: row.assignedInspectorId,
    linkedInspectionId: row.linkedInspectionId,
    reviewNotes: row.reviewNotes,
    resolution: row.resolution,
    reviewerById: row.reviewerById,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    dismissedReason: row.dismissedReason,
    dismissedById: row.dismissedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface FlagWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateFlagWrite extends FlagWriteContext {
  id?: string;
  projectId: string;
  organisationId?: string | null;
  allocationId?: string | null;
  riskScore: number;
  riskLevel: InspectionFlagRiskLevel;
  triggerSource: InspectionFlagTriggerSource;
  explanation: string;
  evidenceRefs: EvidenceRef[];
}

export interface UpdateFlagWrite extends FlagWriteContext {
  id: string;
  riskScore?: number;
  riskLevel?: InspectionFlagRiskLevel;
  explanation?: string;
  evidenceRefs?: EvidenceRef[];
}

export interface AssignFlagWrite extends FlagWriteContext {
  id: string;
  assignedInspectorId: string;
}

export interface ReviewFlagWrite extends FlagWriteContext {
  id: string;
  reviewNotes: string;
  status?: InspectionFlagStatus;
}

export interface ResolveFlagWrite extends FlagWriteContext {
  id: string;
  resolution: string;
}

export interface DismissFlagWrite extends FlagWriteContext {
  id: string;
  dismissedReason: string;
}

export class InspectionFlagRepository {
  constructor(private db: DrizzleDB) {}

  async list(
    filter: InspectionFlagListQuery,
    jurisdictionDistrictIds?: string[],
  ): Promise<{ items: InspectionFlag[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.projectId) conditions.push(eq(flagsTable.projectId, filter.projectId));
    if (filter.organisationId)
      conditions.push(eq(flagsTable.organisationId, filter.organisationId));
    if (filter.riskLevel) conditions.push(eq(flagsTable.riskLevel, filter.riskLevel));
    if (filter.status) conditions.push(eq(flagsTable.status, filter.status));
    if (filter.assignedInspectorId)
      conditions.push(eq(flagsTable.assignedInspectorId, filter.assignedInspectorId));

    const where = and(...conditions);
    const joinScope = jurisdictionDistrictIds?.length
      ? inArray(projectsTable.districtId, jurisdictionDistrictIds)
      : undefined;

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    const [rows, count] = await Promise.all([
      this.db
        .select({ flag: flagsTable })
        .from(flagsTable)
        .innerJoin(projectsTable, eq(flagsTable.projectId, projectsTable.id))
        .where(and(where, joinScope))
        .orderBy(desc(flagsTable.riskScore), desc(flagsTable.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(flagsTable)
        .innerJoin(projectsTable, eq(flagsTable.projectId, projectsTable.id))
        .where(and(where, joinScope)),
    ]);

    const items = rows.map((r) => toInspectionFlag(r.flag as unknown as InspectionFlagRow));
    return { items, total: count[0]?.count ?? 0 };
  }

  async findById(id: string): Promise<InspectionFlag | null> {
    const rows = await this.db.select().from(flagsTable).where(eq(flagsTable.id, id)).limit(1);
    if (!rows[0]) return null;
    return toInspectionFlag(rows[0] as unknown as InspectionFlagRow);
  }

  async findOpenFlagByProject(projectId: string): Promise<InspectionFlag | null> {
    const rows = await this.db
      .select()
      .from(flagsTable)
      .where(
        and(
          eq(flagsTable.projectId, projectId),
          sql`${flagsTable.status} IN ('open', 'under_review', 'assigned', 'inspection_in_progress')`,
        ),
      )
      .orderBy(desc(flagsTable.createdAt))
      .limit(1);
    if (!rows[0]) return null;
    return toInspectionFlag(rows[0] as unknown as InspectionFlagRow);
  }

  async createWithAudit(cmd: CreateFlagWrite): Promise<InspectionFlag> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(flagsTable)
        .values({
          id: cmd.id,
          projectId: cmd.projectId,
          organisationId: cmd.organisationId,
          allocationId: cmd.allocationId,
          riskScore: cmd.riskScore,
          riskLevel: cmd.riskLevel,
          triggerSource: cmd.triggerSource,
          explanation: cmd.explanation,
          evidenceRefs: cmd.evidenceRefs,
          status: "open",
        })
        .returning();

      const created = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: created.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: created.id,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: created.id,
        payload: {
          ...cmd.eventPayload,
          flagId: created.id,
          projectId: cmd.projectId,
          riskScore: cmd.riskScore,
          riskLevel: cmd.riskLevel,
        },
      });

      return toInspectionFlag(created as unknown as InspectionFlagRow);
    });
  }

  async updateWithAudit(cmd: UpdateFlagWrite): Promise<InspectionFlag> {
    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (cmd.riskScore !== undefined) patch.riskScore = cmd.riskScore;
      if (cmd.riskLevel !== undefined) patch.riskLevel = cmd.riskLevel;
      if (cmd.explanation !== undefined) patch.explanation = cmd.explanation;
      if (cmd.evidenceRefs !== undefined) patch.evidenceRefs = cmd.evidenceRefs;

      const rows = await tx
        .update(flagsTable)
        .set(patch)
        .where(eq(flagsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          flagId: updated.id,
          riskScore: updated.riskScore,
          riskLevel: updated.riskLevel,
        },
      });

      return toInspectionFlag(updated as unknown as InspectionFlagRow);
    });
  }

  async assignWithAudit(cmd: AssignFlagWrite): Promise<InspectionFlag> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(flagsTable)
        .set({
          assignedInspectorId: cmd.assignedInspectorId,
          status: "assigned",
          updatedAt: new Date(),
        })
        .where(eq(flagsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          flagId: updated.id,
          assignedInspectorId: cmd.assignedInspectorId,
          status: "assigned",
        },
      });

      return toInspectionFlag(updated as unknown as InspectionFlagRow);
    });
  }

  async reviewWithAudit(cmd: ReviewFlagWrite): Promise<InspectionFlag> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(flagsTable)
        .set({
          reviewNotes: cmd.reviewNotes,
          status: cmd.status ?? "under_review",
          reviewerById: cmd.actorUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(flagsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      return toInspectionFlag(updated as unknown as InspectionFlagRow);
    });
  }

  async resolveWithAudit(cmd: ResolveFlagWrite): Promise<InspectionFlag> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(flagsTable)
        .set({
          resolution: cmd.resolution,
          status: "resolved",
          reviewerById: cmd.actorUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(flagsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          flagId: updated.id,
          status: "resolved",
        },
      });

      return toInspectionFlag(updated as unknown as InspectionFlagRow);
    });
  }

  async dismissWithAudit(cmd: DismissFlagWrite): Promise<InspectionFlag> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(flagsTable)
        .set({
          dismissedReason: cmd.dismissedReason,
          status: "dismissed",
          dismissedById: cmd.actorUserId,
          updatedAt: new Date(),
        })
        .where(eq(flagsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          flagId: updated.id,
          status: "dismissed",
        },
      });

      return toInspectionFlag(updated as unknown as InspectionFlagRow);
    });
  }

  async linkInspectionWithAudit(
    flagId: string,
    inspectionId: string,
    actorUserId: string | null,
  ): Promise<InspectionFlag> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(flagsTable)
        .set({
          linkedInspectionId: inspectionId,
          status: "inspection_in_progress",
          updatedAt: new Date(),
        })
        .where(eq(flagsTable.id, flagId))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: "financial_risk.flag_assigned",
        actorUserId,
        resourceType: "inspection_flag",
        resourceId: updated.id,
        metadata: { linkedInspectionId: inspectionId },
      });

      return toInspectionFlag(updated as unknown as InspectionFlagRow);
    });
  }
}
