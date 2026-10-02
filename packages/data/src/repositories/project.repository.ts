import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  projects as projectsTable,
  projectGeofences as projectGeofencesTable,
  authorities as authoritiesTable,
  organisations as organisationsTable,
  programmes as programmesTable,
  districts as districtsTable,
  states as statesTable,
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
  villageId: string | null;
  schemeComponentId: string | null;
  status: ProjectStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
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
    villageId: row.villageId,
    schemeComponentId: row.schemeComponentId,
    status: row.status,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    programmeIds: row.programmeIds ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Read-path row: the project plus its resolved related-entity names. */
export interface ProjectWithNamesRow {
  project: ProjectRow;
  organisationName: string | null;
  authorityName: string | null;
  districtName: string | null;
  stateName: string | null;
  programmeNames: string[] | null;
}

export function toProjectWithNames(row: ProjectWithNamesRow): Project {
  return {
    ...toProject(row.project),
    organisationName: row.organisationName,
    authorityName: row.authorityName,
    districtName: row.districtName,
    stateName: row.stateName,
    programmeNames: row.programmeNames ?? [],
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
  villageId: string | null;
  schemeComponentId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
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
  villageId: string | null;
  schemeComponentId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  programmeIds: string[];
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface UpdateProjectContactWrite {
  projectId: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
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

  /**
   * Project rows joined to their organisation, authority, district/state and
   * programme names. Read paths must use this so the API can disclose real
   * display names instead of leaving the presentation layer to guess from a
   * UUID.
   *
   * `programme_ids` is a json column, not a Postgres array, so programme names
   * are aggregated in a derived table. Joining that 1:1 keeps the outer query
   * free of GROUP BY over every project column.
   */
  private selectWithNames() {
    const programmeNames = this.db
      .select({
        projectId: projectsTable.id,
        names: sql<string[]>`array_agg(${programmesTable.name})`.as("names"),
      })
      .from(projectsTable)
      .innerJoin(
        programmesTable,
        sql`${programmesTable.id}::text = any (select jsonb_array_elements_text(${projectsTable.programmeIds}::jsonb))`,
      )
      .groupBy(projectsTable.id)
      .as("project_programme_names");

    return this.db
      .select({
        project: projectsTable,
        organisationName: organisationsTable.name,
        authorityName: authoritiesTable.name,
        districtName: districtsTable.name,
        stateName: statesTable.name,
        programmeNames: programmeNames.names,
      })
      .from(projectsTable)
      .leftJoin(organisationsTable, eq(projectsTable.organisationId, organisationsTable.id))
      .leftJoin(authoritiesTable, eq(projectsTable.authorityId, authoritiesTable.id))
      .leftJoin(districtsTable, eq(projectsTable.districtId, districtsTable.id))
      .leftJoin(statesTable, eq(districtsTable.stateId, statesTable.id))
      .leftJoin(programmeNames, eq(projectsTable.id, programmeNames.projectId));
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.selectWithNames().where(eq(projectsTable.id, id)).limit(1);
    const found = row[0];
    if (!found) return null;
    return toProjectWithNames(found as unknown as ProjectWithNamesRow);
  }

  async findByCode(code: string): Promise<Project | null> {
    const row = await this.selectWithNames().where(eq(projectsTable.code, code)).limit(1);
    const found = row[0];
    if (!found) return null;
    return toProjectWithNames(found as unknown as ProjectWithNamesRow);
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
      this.selectWithNames()
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
      items: rows.map((r) => toProjectWithNames(r as unknown as ProjectWithNamesRow)),
      total: count[0]?.count ?? 0,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async findAllActiveProjects(): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      districtId: string | null;
      organisationId: string | null;
    }>
  > {
    return this.db
      .select({
        id: projectsTable.id,
        code: projectsTable.code,
        name: projectsTable.name,
        districtId: projectsTable.districtId,
        organisationId: projectsTable.organisationId,
      })
      .from(projectsTable)
      .where(eq(projectsTable.status, "Active"));
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
          villageId: write.villageId,
          schemeComponentId: write.schemeComponentId,
          contactName: write.contactName,
          contactPhone: write.contactPhone,
          contactEmail: write.contactEmail,
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
          villageId: write.villageId,
          schemeComponentId: write.schemeComponentId,
          contactName: write.contactName,
          contactPhone: write.contactPhone,
          contactEmail: write.contactEmail,
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
   * Updates only the facility's contact detail columns and writes the audit +
   * outbox rows in the SAME transaction (§25: state change + audit + event are
   * one atomic business operation).
   */
  async updateContactWithAuditAndEvent(write: UpdateProjectContactWrite): Promise<Project> {
    const updated: Project = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(projectsTable)
        .set({
          ...(write.contactName !== undefined ? { contactName: write.contactName } : {}),
          ...(write.contactPhone !== undefined ? { contactPhone: write.contactPhone } : {}),
          ...(write.contactEmail !== undefined ? { contactEmail: write.contactEmail } : {}),
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.id, write.projectId))
        .returning();
      if (!rows[0]) return null as unknown as Project;
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
      ? this.db
          .select()
          .from(projectGeofencesTable)
          .where(inArray(projectGeofencesTable.projectId, projectIds))
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
