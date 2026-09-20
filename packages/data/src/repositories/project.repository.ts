import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  projects as projectsTable,
  projectGeofences as projectGeofencesTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  Page,
  Project,
  ProjectGeofence,
  GeofenceType,
  ProjectStatus,
  ProjectType,
} from "@netram/types";
import type { AuditAction } from "@netram/types";
import type { DomainEventType } from "@netram/types";

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  type: ProjectType;
  description: string | null;
  organisationId: string | null;
  authorityId: string | null;
  districtId: string | null;
  status: ProjectStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  programmeIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    description: row.description,
    organisationId: row.organisationId,
    authorityId: row.authorityId,
    districtId: row.districtId,
    status: row.status,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    programmeIds: row.programmeIds ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CreateProjectWrite {
  id: string;
  code: string;
  name: string;
  type: ProjectType;
  description: string | null;
  organisationId: string | null;
  authorityId: string | null;
  districtId: string | null;
  programmeIds: string[];
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface UpdateProjectWrite {
  projectId: string;
  name: string;
  type: ProjectType;
  description: string | null;
  organisationId: string | null;
  districtId: string | null;
  programmeIds: string[];
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface TransitionProjectWrite {
  projectId: string;
  to: ProjectStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  note: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface ProjectListFilter {
  status?: ProjectStatus;
  organisationId?: string;
  /** Jurisdictional scope filter: only projects whose districtId is in this set. */
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

export class ProjectRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: string): Promise<Project | null> {
    const row = await this.db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
    const found = row[0];
    if (!found) return null;
    return toProject(found as unknown as ProjectRow);
  }

  async findByCode(code: string): Promise<Project | null> {
    const row = await this.db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.code, code))
      .limit(1);
    const found = row[0];
    if (!found) return null;
    return toProject(found as unknown as ProjectRow);
  }

  async list(filter: ProjectListFilter): Promise<Page<Project>> {
    const conditions = [];
    if (filter.status) conditions.push(eq(projectsTable.status, filter.status));
    if (filter.organisationId)
      conditions.push(eq(projectsTable.organisationId, filter.organisationId));
    if (filter.jurisdictionIds && filter.jurisdictionIds.length > 0) {
      conditions.push(inArray(projectsTable.districtId, filter.jurisdictionIds));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, count] = await Promise.all([
      this.db
        .select()
        .from(projectsTable)
        .where(where)
        .orderBy(desc(projectsTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(projectsTable)
        .where(where),
    ]);

    return {
      items: rows.map((r) => toProject(r as unknown as ProjectRow)),
      total: count[0]?.count ?? 0,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  /** Creates a project and writes audit + outbox rows in the same transaction. */
  async createWithAuditAndEvent(write: CreateProjectWrite): Promise<Project> {
    const created: Project = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(projectsTable)
        .values({
          id: write.id,
          code: write.code,
          name: write.name,
          type: write.type,
          description: write.description,
          organisationId: write.organisationId,
          authorityId: write.authorityId,
          districtId: write.districtId,
          programmeIds: write.programmeIds,
        })
        .returning();
      const project = toProject(rows[0] as unknown as ProjectRow);

      await tx.insert(auditEvents).values({
        action: write.auditAction,
        actorUserId: write.actorUserId,
        resourceType: "project",
        resourceId: project.id,
        requestId: write.requestId,
        ipAddress: write.ipAddress,
        metadata: { ...write.auditMetadata, code: project.code },
      });

      await tx.insert(outboxEvents).values({
        type: write.eventType,
        correlationId: project.id,
        actorUserId: write.actorUserId,
        resourceType: "project",
        resourceId: project.id,
        payload: { ...write.eventPayload, projectId: project.id },
      });

      return project;
    });
    return created;
  }

  /** Updates project fields and writes audit + outbox rows in the SAME transaction. */
  async updateWithAuditAndEvent(write: UpdateProjectWrite): Promise<Project> {
    const updated: Project = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(projectsTable)
        .set({
          name: write.name,
          type: write.type,
          description: write.description,
          organisationId: write.organisationId,
          districtId: write.districtId,
          programmeIds: write.programmeIds,
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.id, write.projectId))
        .returning();
      const project = toProject(rows[0] as unknown as ProjectRow);

      await tx.insert(auditEvents).values({
        action: write.auditAction,
        actorUserId: write.actorUserId,
        resourceType: "project",
        resourceId: project.id,
        requestId: write.requestId,
        ipAddress: write.ipAddress,
        metadata: { ...write.auditMetadata, code: project.code },
      });

      await tx.insert(outboxEvents).values({
        type: write.eventType,
        correlationId: project.id,
        actorUserId: write.actorUserId,
        resourceType: "project",
        resourceId: project.id,
        payload: { ...write.eventPayload, projectId: project.id },
      });

      return project;
    });
    return updated;
  }

  /**
   * Applies a status transition and writes the audit + outbox rows in the SAME transaction.
   * Business rules about allowed transitions must be validated by the application/domain
   * layer before calling this method.
   */
  async transitionProjectWithAuditAndEvent(write: TransitionProjectWrite): Promise<Project> {
    const values: Partial<ProjectRow> = {
      status: write.to,
      approvedById: write.approvedById,
      approvedAt: write.approvedAt,
      updatedAt: new Date(),
    };

    const transitioned: Project = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(projectsTable)
        .set(values)
        .where(eq(projectsTable.id, write.projectId))
        .returning();
      const project = toProject(rows[0] as unknown as ProjectRow);

      await tx.insert(auditEvents).values({
        action: write.auditAction,
        actorUserId: write.actorUserId,
        resourceType: "project",
        resourceId: project.id,
        requestId: write.requestId,
        ipAddress: write.ipAddress,
        metadata: { ...write.auditMetadata, to: write.to },
      });

      await tx.insert(outboxEvents).values({
        type: write.eventType,
        correlationId: project.id,
        actorUserId: write.actorUserId,
        resourceType: "project",
        resourceId: project.id,
        payload: { ...write.eventPayload, projectId: project.id, to: write.to },
      });

      return project;
    });
    return transitioned;
  }

  async findGeofenceByProjectId(projectId: string): Promise<ProjectGeofence | null> {
    const rows = await this.db
      .select()
      .from(projectGeofencesTable)
      .where(eq(projectGeofencesTable.projectId, projectId))
      .limit(1);
    if (!rows[0]) return null;
    return toProjectGeofence(rows[0] as unknown as ProjectGeofenceRow);
  }

  async listGeofences(projectIds?: string[]): Promise<ProjectGeofence[]> {
    if (projectIds && projectIds.length === 0) return [];
    const query = projectIds
      ? this.db.select().from(projectGeofencesTable).where(inArray(projectGeofencesTable.projectId, projectIds))
      : this.db.select().from(projectGeofencesTable);
    const rows = await query;
    return rows.map((r) => toProjectGeofence(r as unknown as ProjectGeofenceRow));
  }

  async sealGeofenceWithAuditAndEvent(write: SealGeofenceWrite): Promise<ProjectGeofence> {
    const sealed: ProjectGeofence = await this.db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .insert(projectGeofencesTable)
        .values({
          projectId: write.projectId,
          type: write.type,
          radiusMeters: write.radiusMeters,
          centerLat: write.centerLat,
          centerLng: write.centerLng,
          polygonVertices: write.polygonVertices,
          sealedById: write.sealedById,
          sealedAt: write.sealedAt,
          auditTx: write.auditTx,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: projectGeofencesTable.projectId,
          set: {
            type: write.type,
            radiusMeters: write.radiusMeters,
            centerLat: write.centerLat,
            centerLng: write.centerLng,
            polygonVertices: write.polygonVertices,
            sealedById: write.sealedById,
            sealedAt: write.sealedAt,
            auditTx: write.auditTx,
            updatedAt: now,
          },
        })
        .returning();

      const geofence = toProjectGeofence(rows[0] as unknown as ProjectGeofenceRow);

      await tx.insert(auditEvents).values({
        action: write.auditAction,
        actorUserId: write.actorUserId,
        resourceType: "project_geofence",
        resourceId: geofence.id,
        requestId: write.requestId,
        ipAddress: write.ipAddress,
        metadata: { ...write.auditMetadata, geofenceId: geofence.id },
      });

      await tx.insert(outboxEvents).values({
        type: write.eventType,
        correlationId: write.projectId,
        actorUserId: write.actorUserId,
        resourceType: "project_geofence",
        resourceId: geofence.id,
        payload: { ...write.eventPayload, geofenceId: geofence.id },
      });

      return geofence;
    });

    return sealed;
  }
}

export interface ProjectGeofenceRow {
  id: string;
  projectId: string;
  type: GeofenceType;
  radiusMeters: number;
  centerLat: number | null;
  centerLng: number | null;
  polygonVertices: [number, number][];
  sealedById: string | null;
  sealedAt: Date;
  auditTx: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toProjectGeofence(row: ProjectGeofenceRow): ProjectGeofence {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    radiusMeters: row.radiusMeters,
    centerLat: row.centerLat,
    centerLng: row.centerLng,
    polygonVertices: row.polygonVertices ?? [],
    sealedById: row.sealedById,
    sealedAt: row.sealedAt instanceof Date ? row.sealedAt.toISOString() : String(row.sealedAt),
    auditTx: row.auditTx,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export interface SealGeofenceWrite {
  projectId: string;
  type: GeofenceType;
  radiusMeters: number;
  centerLat: number | null;
  centerLng: number | null;
  polygonVertices: [number, number][];
  sealedById: string | null;
  sealedAt: Date;
  auditTx: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

