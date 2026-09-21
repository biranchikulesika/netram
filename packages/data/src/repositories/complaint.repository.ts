import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  complaints as complaintsTable,
  projects as projectsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { AuditAction, Complaint, ComplaintStatus, DomainEventType } from "@netram/types";

export interface ComplaintRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  districtId: string | null;
  complainantName: string | null;
  contactInfo: string | null;
  trackingCode: string;
  description: string;
  status: ComplaintStatus;
  receivedAt: Date;
  resolutionText: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toComplaint(row: ComplaintRow): Complaint {
  return {
    id: row.id,
    projectId: row.projectId,
    projectCode: row.projectCode,
    projectName: row.projectName,
    districtId: row.districtId,
    complainantName: row.complainantName,
    contactInfo: row.contactInfo,
    trackingCode: row.trackingCode,
    description: row.description,
    status: row.status,
    receivedAt: row.receivedAt.toISOString(),
    resolutionText: row.resolutionText,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface ComplaintWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateComplaintWrite extends ComplaintWriteContext {
  id: string;
  projectId: string;
  complainantName: string | null;
  contactInfo: string | null;
  trackingCode: string;
  description: string;
}

export interface TransitionComplaintWrite extends ComplaintWriteContext {
  complaintId: string;
  to: ComplaintStatus;
  resolutionText: string | null;
}

export interface ComplaintListFilter {
  status?: ComplaintStatus;
  projectId?: string;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

/**
 * Persistence for complaints (§35). Complaints are district-scoped through
 * their project. All mutations plus audit and outbox are atomic.
 */
export class ComplaintRepository {
  constructor(private db: DrizzleDB) {}

  async list(filter: ComplaintListFilter): Promise<{ items: Complaint[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.status) conditions.push(eq(complaintsTable.status, filter.status));
    if (filter.projectId) conditions.push(eq(complaintsTable.projectId, filter.projectId));
    const where = and(...conditions);

    const joinScope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;

    const [rows, count] = await Promise.all([
      this.db
        .select({
          complaint: complaintsTable,
          projectCode: projectsTable.code,
          projectName: projectsTable.name,
          districtId: projectsTable.districtId,
        })
        .from(complaintsTable)
        .innerJoin(projectsTable, eq(complaintsTable.projectId, projectsTable.id))
        .where(and(where, joinScope))
        .orderBy(desc(complaintsTable.receivedAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(complaintsTable)
        .innerJoin(projectsTable, eq(complaintsTable.projectId, projectsTable.id))
        .where(and(where, joinScope)),
    ]);

    const items = rows.map((r) =>
      toComplaint({
        ...r.complaint,
        projectCode: r.projectCode,
        projectName: r.projectName,
        districtId: r.districtId,
      } as unknown as ComplaintRow),
    );
    return { items, total: count[0]?.count ?? 0 };
  }

  async findById(id: string): Promise<Complaint | null> {
    const rows = await this.db
      .select({
        complaint: complaintsTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
      })
      .from(complaintsTable)
      .innerJoin(projectsTable, eq(complaintsTable.projectId, projectsTable.id))
      .where(eq(complaintsTable.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return toComplaint({
      ...row.complaint,
      projectCode: row.projectCode,
      projectName: row.projectName,
      districtId: row.districtId,
    } as unknown as ComplaintRow);
  }

  async findByTrackingCode(trackingCode: string): Promise<Complaint | null> {
    const rows = await this.db
      .select({
        complaint: complaintsTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
      })
      .from(complaintsTable)
      .innerJoin(projectsTable, eq(complaintsTable.projectId, projectsTable.id))
      .where(eq(complaintsTable.trackingCode, trackingCode))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return toComplaint({
      ...row.complaint,
      projectCode: row.projectCode,
      projectName: row.projectName,
      districtId: row.districtId,
    } as unknown as ComplaintRow);
  }

  async createWithAuditAndEvent(cmd: CreateComplaintWrite): Promise<Complaint> {
    const created: Complaint = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(complaintsTable)
        .values({
          id: cmd.id,
          projectId: cmd.projectId,
          complainantName: cmd.complainantName,
          contactInfo: cmd.contactInfo,
          trackingCode: cmd.trackingCode,
          description: cmd.description,
          status: "received",
        })
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "complaint",
        resourceId: cmd.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      // PII never reaches the outbox (§35, §39): no complainant name / contact.
      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.id,
        actorUserId: cmd.actorUserId,
        resourceType: "complaint",
        resourceId: cmd.id,
        payload: {
          ...cmd.eventPayload,
          trackingCode: cmd.trackingCode,
          status: "received",
        },
      });

      const projectRows = await tx
        .select({
          code: projectsTable.code,
          name: projectsTable.name,
          districtId: projectsTable.districtId,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, cmd.projectId))
        .limit(1);
      const project = projectRows[0]!;
      return toComplaint({
        ...row,
        projectCode: project.code,
        projectName: project.name,
        districtId: project.districtId,
      } as unknown as ComplaintRow);
    });
    return created;
  }

  async transitionWithAuditAndEvent(cmd: TransitionComplaintWrite): Promise<Complaint> {
    const transitioned: Complaint = await this.db.transaction(async (tx) => {
      const sets: Record<string, unknown> = {
        status: cmd.to,
        updatedAt: new Date(),
      };
      if (cmd.to === "resolved") {
        sets.resolutionText = cmd.resolutionText;
        sets.resolvedAt = new Date();
      }
      const rows = await tx
        .update(complaintsTable)
        .set(sets)
        .where(eq(complaintsTable.id, cmd.complaintId))
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "complaint",
        resourceId: cmd.complaintId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.complaintId,
        actorUserId: cmd.actorUserId,
        resourceType: "complaint",
        resourceId: cmd.complaintId,
        payload: { ...cmd.eventPayload },
      });

      const projectRows = await tx
        .select({
          code: projectsTable.code,
          name: projectsTable.name,
          districtId: projectsTable.districtId,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, row.projectId))
        .limit(1);
      const project = projectRows[0]!;
      return toComplaint({
        ...row,
        projectCode: project.code,
        projectName: project.name,
        districtId: project.districtId,
      } as unknown as ComplaintRow);
    });
    return transitioned;
  }
}
