import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  complaints as complaintsTable,
  complaintFiles as complaintFilesTable,
  projects as projectsTable,
  districts as districtsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  AuditAction,
  Complaint,
  ComplaintFile,
  ComplaintStatus,
  DomainEventType,
} from "@netram/types";

export interface ComplaintFileRow {
  id: string;
  complaintId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  storageKey: string;
  createdAt: Date;
}

export function toComplaintFile(row: ComplaintFileRow): ComplaintFile {
  return {
    id: row.id,
    complaintId: row.complaintId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ComplaintRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  districtId: string | null;
  districtName: string | null;
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

export function toComplaint(row: ComplaintRow, files: ComplaintFile[] = []): Complaint {
  return {
    id: row.id,
    projectId: row.projectId,
    projectCode: row.projectCode,
    projectName: row.projectName,
    districtId: row.districtId,
    districtName: row.districtName,
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
    files,
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

export interface ComplaintFileWrite {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  storageKey: string;
}

export interface CreateComplaintWrite extends ComplaintWriteContext {
  id: string;
  projectId: string;
  complainantName: string | null;
  contactInfo: string | null;
  trackingCode: string;
  description: string;
  files?: ComplaintFileWrite[];
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

/** Row shape returned by {@link ComplaintRepository.baseQuery}. */
interface ComplaintJoinedRow {
  complaint: Record<string, unknown>;
  projectCode: string;
  projectName: string;
  districtId: string | null;
  districtName: string | null;
}

function flattenComplaintRow(row: ComplaintJoinedRow): ComplaintRow {
  return {
    ...(row.complaint as unknown as ComplaintRow),
    projectCode: row.projectCode,
    projectName: row.projectName,
    districtId: row.districtId,
    districtName: row.districtName,
  };
}

/**
 * Persistence for complaints (§35). Complaints are district-scoped through
 * their project. All mutations plus audit and outbox are atomic.
 */
export class ComplaintRepository {
  constructor(private db: DrizzleDB) {}

  /**
   * Complaint rows joined to their project and the project's district, so the
   * API discloses the district name instead of leaving the client to guess it
   * from a UUID.
   */
  private baseQuery() {
    return this.db
      .select({
        complaint: complaintsTable,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
        districtName: districtsTable.name,
      })
      .from(complaintsTable)
      .innerJoin(projectsTable, eq(complaintsTable.projectId, projectsTable.id))
      .leftJoin(districtsTable, eq(projectsTable.districtId, districtsTable.id));
  }

  /** Project identity a complaint row is reported against, including its district name. */
  private async projectIdentity(
    executor: Pick<DrizzleDB, "select">,
    projectId: string,
  ): Promise<{ code: string; name: string; districtId: string | null; districtName: string | null }> {
    const rows = await executor
      .select({
        code: projectsTable.code,
        name: projectsTable.name,
        districtId: projectsTable.districtId,
        districtName: districtsTable.name,
      })
      .from(projectsTable)
      .leftJoin(districtsTable, eq(projectsTable.districtId, districtsTable.id))
      .where(eq(projectsTable.id, projectId))
      .limit(1);
    return rows[0]!;
  }

  async list(filter: ComplaintListFilter): Promise<{ items: Complaint[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.status) conditions.push(eq(complaintsTable.status, filter.status));
    if (filter.projectId) conditions.push(eq(complaintsTable.projectId, filter.projectId));
    const where = and(...conditions);

    const joinScope = filter.jurisdictionIds?.length
      ? inArray(projectsTable.districtId, filter.jurisdictionIds)
      : undefined;

    const [rows, count] = await Promise.all([
      this.baseQuery()
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

    const items = rows.map((r) => toComplaint(flattenComplaintRow(r)));
    return { items, total: count[0]?.count ?? 0 };
  }

  async findById(id: string): Promise<Complaint | null> {
    const rows = await this.baseQuery().where(eq(complaintsTable.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return toComplaint(flattenComplaintRow(row), await this.listFiles(id));
  }

  async listFiles(complaintId: string): Promise<ComplaintFile[]> {
    const rows = await this.db
      .select()
      .from(complaintFilesTable)
      .where(eq(complaintFilesTable.complaintId, complaintId))
      .orderBy(complaintFilesTable.createdAt);
    return rows.map((r) => toComplaintFile(r as unknown as ComplaintFileRow));
  }

  async findFileById(id: string): Promise<{
    file: ComplaintFile;
    complaintId: string;
    storageKey: string;
  } | null> {
    const rows = await this.db
      .select()
      .from(complaintFilesTable)
      .where(eq(complaintFilesTable.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      file: toComplaintFile(row as unknown as ComplaintFileRow),
      complaintId: row.complaintId,
      storageKey: row.storageKey,
    };
  }

  async findByTrackingCode(trackingCode: string): Promise<Complaint | null> {
    const rows = await this.baseQuery().where(eq(complaintsTable.trackingCode, trackingCode)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return toComplaint(flattenComplaintRow(row));
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

      if (cmd.files && cmd.files.length > 0) {
        await tx.insert(complaintFilesTable).values(
          cmd.files.map((f) => ({
            id: f.id,
            complaintId: cmd.id,
            fileName: f.fileName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            contentHash: f.contentHash,
            storageKey: f.storageKey,
          })),
        );
      }

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

      const project = await this.projectIdentity(tx, cmd.projectId);

      const fileRows = cmd.files?.length
        ? await tx
            .select()
            .from(complaintFilesTable)
            .where(eq(complaintFilesTable.complaintId, cmd.id))
            .orderBy(complaintFilesTable.createdAt)
        : [];
      return toComplaint(
        {
          ...row,
          projectCode: project.code,
          projectName: project.name,
          districtId: project.districtId,
          districtName: project.districtName,
        } as unknown as ComplaintRow,
        fileRows.map((r) => toComplaintFile(r as unknown as ComplaintFileRow)),
      );
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

      const project = await this.projectIdentity(tx, row.projectId);
      return toComplaint({
        ...row,
        projectCode: project.code,
        projectName: project.name,
        districtId: project.districtId,
        districtName: project.districtName,
      } as unknown as ComplaintRow);
    });
    return transitioned;
  }
}
