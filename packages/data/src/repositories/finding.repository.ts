import { and, desc, eq, inArray, notExists } from "drizzle-orm";
import {
  correctiveActions as correctiveActionsTable,
  findings as findingsTable,
  inspections as inspectionsTable,
  projects as projectsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  AuditAction,
  DomainEventType,
  Finding,
  FindingAwaitingOrder,
  FindingSeverity,
  FindingStatus,
} from "@netram/types";

export interface FindingRow {
  id: string;
  inspectionId: string;
  observationId: string | null;
  severity: FindingSeverity;
  description: string;
  remediation: string | null;
  status: FindingStatus;
  categoryId: string | null;
  amountInr: number | null;
  responsibleOrganisationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    observationId: row.observationId,
    severity: row.severity,
    description: row.description,
    remediation: row.remediation,
    status: row.status,
    categoryId: row.categoryId,
    amountInr: row.amountInr,
    responsibleOrganisationId: row.responsibleOrganisationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface FindingWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateFindingWrite extends FindingWriteContext {
  id: string;
  inspectionId: string;
  observationId: string | null;
  severity: FindingSeverity;
  description: string;
  remediation: string | null;
  categoryId: string | null;
  amountInr: number | null;
  responsibleOrganisationId: string | null;
}

export interface TransitionFindingWrite extends FindingWriteContext {
  findingId: string;
  to: FindingStatus;
  note: string | null;
}

/**
 * Persistence for findings. All mutations plus audit and outbox are atomic.
 */
export class FindingRepository {
  constructor(private db: DrizzleDB) {}

  async listByInspection(inspectionId: string): Promise<Finding[]> {
    const rows = await this.db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.inspectionId, inspectionId))
      .orderBy(desc(findingsTable.createdAt));
    return rows.map((r) => toFinding(r as unknown as FindingRow));
  }

  async findById(id: string): Promise<Finding | null> {
    const rows = await this.db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return toFinding(rows[0] as unknown as FindingRow);
  }

  /**
   * Confirmed findings without a corrective action, optionally scoped to the
   * given project district IDs. Joins inspection + project so authorities can
   * identify the facility when ordering remediation.
   */
  async listAwaitingOrder(jurisdictionIds?: string[]): Promise<FindingAwaitingOrder[]> {
    const rows = await this.db
      .select({
        id: findingsTable.id,
        inspectionId: findingsTable.inspectionId,
        observationId: findingsTable.observationId,
        severity: findingsTable.severity,
        description: findingsTable.description,
        remediation: findingsTable.remediation,
        status: findingsTable.status,
        categoryId: findingsTable.categoryId,
        amountInr: findingsTable.amountInr,
        responsibleOrganisationId: findingsTable.responsibleOrganisationId,
        createdAt: findingsTable.createdAt,
        updatedAt: findingsTable.updatedAt,
        inspectionStatus: inspectionsTable.status,
        projectId: projectsTable.id,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
        organisationId: projectsTable.organisationId,
      })
      .from(findingsTable)
      .innerJoin(inspectionsTable, eq(findingsTable.inspectionId, inspectionsTable.id))
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
      .where(
        and(
          eq(findingsTable.status, "confirmed"),
          notExists(
            this.db
              .select({ id: correctiveActionsTable.id })
              .from(correctiveActionsTable)
              .where(eq(correctiveActionsTable.findingId, findingsTable.id)),
          ),
          jurisdictionIds?.length ? inArray(projectsTable.districtId, jurisdictionIds) : undefined,
        ),
      )
      .orderBy(desc(findingsTable.createdAt));
    return rows.map(
      (r) =>
        ({
          id: r.id,
          inspectionId: r.inspectionId,
          observationId: r.observationId,
          severity: r.severity,
          description: r.description,
          remediation: r.remediation,
          status: r.status,
          categoryId: r.categoryId,
          amountInr: r.amountInr,
          responsibleOrganisationId: r.responsibleOrganisationId,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          inspectionStatus: r.inspectionStatus,
          project: {
            id: r.projectId,
            code: r.projectCode,
            name: r.projectName,
            districtId: r.districtId,
            organisationId: r.organisationId,
          },
        }) as FindingAwaitingOrder,
    );
  }

  async createWithAuditAndEvent(cmd: CreateFindingWrite): Promise<Finding> {
    const created: Finding = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(findingsTable)
        .values({
          id: cmd.id,
          inspectionId: cmd.inspectionId,
          observationId: cmd.observationId,
          severity: cmd.severity,
          description: cmd.description,
          remediation: cmd.remediation,
          status: "new",
          categoryId: cmd.categoryId,
          amountInr: cmd.amountInr,
          responsibleOrganisationId: cmd.responsibleOrganisationId,
        })
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: {
          ...cmd.auditMetadata,
          inspectionId: cmd.inspectionId,
          severity: cmd.severity,
          categoryId: cmd.categoryId,
          amountInr: cmd.amountInr,
        },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.id,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.id,
        payload: {
          ...cmd.eventPayload,
          findingId: cmd.id,
          inspectionId: cmd.inspectionId,
          status: "new",
        },
      });

      return toFinding(row as unknown as FindingRow);
    });
    return created;
  }

  async transitionWithAuditAndEvent(cmd: TransitionFindingWrite): Promise<Finding> {
    const current = await this.findById(cmd.findingId);
    if (!current) throw new Error("finding missing");

    const transitioned: Finding = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(findingsTable)
        .set({ status: cmd.to, updatedAt: new Date() })
        .where(eq(findingsTable.id, cmd.findingId))
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.findingId,
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
        correlationId: cmd.findingId,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.findingId,
        payload: {
          ...cmd.eventPayload,
          findingId: cmd.findingId,
          from: current.status,
          to: cmd.to,
        },
      });

      return toFinding(row as unknown as FindingRow);
    });
    return transitioned;
  }
}
