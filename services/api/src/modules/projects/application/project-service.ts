import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "./ports/project-repository.js";
import { evaluateTransition } from "../domain/project.js";
import type {
  Page,
  Project,
  ProjectGeofence,
  ProjectListQuery,
  ProjectRegistryItem,
  ProjectType,
} from "@netram/types";

export interface CreateProjectInput {
  name: string;
  type?: ProjectType;
  description?: string | null;
  organisationId?: string | null;
  districtId?: string | null;
  /** Village-level location for village-type targets (docs/DoSJE.md §25). */
  villageId?: string | null;
  /** Scheme component this target is an instance of (docs/DoSJE.md §21). */
  schemeComponentId?: string | null;
  programmeIds?: string[];
}

export interface SealGeofenceInput {
  type: "circle" | "polygon";
  radiusMeters?: number;
  centerLat?: number;
  centerLng?: number;
  polygonVertices?: [number, number][];
}

const CREATE = "project:create" as const;
const READ = "project:read" as const;
const TRANSITION = "project:transition" as const;
const APPROVE = "project:approve" as const;

const EDITABLE_STATUSES = new Set<Project["status"]>(["Draft", "Pending Verification"]);

export class ProjectService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repository: ProjectRepositoryPort,
  ) {}

  async listProjects(ctx: RequestUserContext, query: ProjectListQuery): Promise<Page<Project>> {
    this.authz.requirePermission(ctx, READ);

    const scope = this.authz.accessibleDistrictIds(ctx);
    return this.repository.list({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
      organisationId: query.organisationId,
      jurisdictionIds: scope ? [...scope] : undefined,
    });
  }

  /**
   * Verification queue: facility registrations awaiting an authority decision
   * (status "Pending Verification", within the caller's jurisdiction reach).
   * Approving still goes through the standard transition endpoint, which
   * re-checks project:approve + jurisdiction server-side.
   */
  async listVerificationQueue(ctx: RequestUserContext): Promise<Page<Project>> {
    this.authz.requirePermission(ctx, APPROVE);

    const scope = this.authz.accessibleDistrictIds(ctx);
    return this.repository.list({
      page: 1,
      pageSize: 100,
      status: "Pending Verification",
      organisationId: undefined,
      jurisdictionIds: scope ? [...scope] : undefined,
    });
  }

  /**
   * Public facility registry for the citizen grievance portal (no authz):
   * a minimal, jurisdiction-free reference of monitored facilities.
   */
  async listPublicRegistry(): Promise<ProjectRegistryItem[]> {
    const page = await this.repository.list({ page: 1, pageSize: 1000 });
    return page.items.map((p) => ({ id: p.id, code: p.code, name: p.name }));
  }

  async getProject(ctx: RequestUserContext, id: string): Promise<Project> {
    this.authz.requirePermission(ctx, READ);
    const project = await this.repository.findById(id);

    if (!project) {
      // Do not distinguish "missing" from "outside your jurisdiction".
      throw AppError.notFound("Project not found.");
    }
    if (!this.authz.canAccessDistrict(ctx, project.districtId)) {
      throw AppError.notFound("Project not found.");
    }
    return project;
  }

  async createProject(ctx: RequestUserContext, input: CreateProjectInput): Promise<Project> {
    this.authz.requirePermission(ctx, CREATE);
    if (input.districtId && !this.authz.canAccessDistrict(ctx, input.districtId)) {
      throw AppError.forbidden("Project is outside your jurisdiction.");
    }

    const id = randomUUID();
    const code = `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`;

    return this.repository.createWithAuditAndEvent({
      id,
      code,
      name: input.name,
      type: input.type ?? "institution",
      description: input.description ?? null,
      organisationId: input.organisationId ?? null,
      authorityId: this.authorityIdOrNull(ctx),
      districtId: input.districtId ?? null,
      villageId: input.villageId ?? null,
      schemeComponentId: input.schemeComponentId ?? null,
      programmeIds: input.programmeIds ?? [],
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "project.created",
      auditMetadata: { name: input.name, code },
      eventType: "project.created",
      eventPayload: { name: input.name, code },
    });
  }

  async updateProject(
    ctx: RequestUserContext,
    projectId: string,
    input: CreateProjectInput,
  ): Promise<Project> {
    this.authz.requirePermission(ctx, CREATE);
    const project = await this.repository.findById(projectId);
    if (!project) throw AppError.notFound("Project not found.");
    if (!this.authz.canAccessDistrict(ctx, project.districtId)) {
      throw AppError.notFound("Project not found.");
    }
    if (!EDITABLE_STATUSES.has(project.status)) {
      throw AppError.conflict(
        `Project cannot be edited from its current status (${project.status}).`,
      );
    }
    if (input.districtId && !this.authz.canAccessDistrict(ctx, input.districtId)) {
      throw AppError.forbidden("Project is outside your jurisdiction.");
    }

    return this.repository.updateWithAuditAndEvent({
      projectId,
      name: input.name,
      type: input.type ?? project.type,
      description: input.description ?? project.description,
      organisationId: input.organisationId ?? project.organisationId,
      districtId: input.districtId ?? project.districtId,
      villageId: input.villageId ?? project.villageId,
      schemeComponentId: input.schemeComponentId ?? project.schemeComponentId,
      programmeIds: input.programmeIds ?? project.programmeIds,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "project.updated",
      auditMetadata: { name: input.name, code: project.code },
      eventType: "project.updated",
      eventPayload: { name: input.name, code: project.code },
    });
  }

  async transitionProject(
    ctx: RequestUserContext,
    projectId: string,
    to: Project["status"],
    note?: string,
  ): Promise<Project> {
    const project = await this.repository.findById(projectId);
    if (!project) throw AppError.notFound("Project not found.");
    if (!this.authz.canAccessDistrict(ctx, project.districtId)) {
      throw AppError.notFound("Project not found.");
    }

    const decision = evaluateTransition(project.status, to);

    if (decision.requiresApproval) {
      // Approvals are an authority-only action (project:approve permission).
      this.authz.requirePermission(ctx, APPROVE, {
        districtId: project.districtId,
      });
    } else {
      this.authz.requirePermission(ctx, TRANSITION, {
        districtId: project.districtId,
      });
    }

    const isApproval = to === "Approved";
    const approvedById = isApproval ? ctx.userId : null;
    const approvedAt = isApproval ? new Date() : null;

    const auditMetadata: Record<string, unknown> = {
      from: project.status,
      to,
      note: note ?? null,
    };
    const eventPayload: Record<string, unknown> = {
      from: project.status,
      to,
      note: note ?? null,
    };

    return this.repository.transitionProjectWithAuditAndEvent({
      projectId,
      to,
      approvedById,
      approvedAt,
      note: note ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "project.transitioned",
      auditMetadata,
      eventType: "project.status_transitioned",
      eventPayload,
    });
  }

  async sealGeofence(
    ctx: RequestUserContext,
    projectId: string,
    input: SealGeofenceInput,
  ): Promise<ProjectGeofence> {
    const project = await this.repository.findById(projectId);
    if (!project) throw AppError.notFound("Project not found.");

    this.authz.requirePermission(ctx, APPROVE, {
      districtId: project.districtId,
    });

    if (input.type === "polygon" && (!input.polygonVertices || input.polygonVertices.length < 3)) {
      throw AppError.badRequest("Polygon perimeter requires at least 3 vertices.");
    }

    const auditTx = `0x${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date();

    return this.repository.sealGeofenceWithAuditAndEvent({
      projectId,
      type: input.type,
      radiusMeters: input.radiusMeters ?? (input.type === "circle" ? 250 : 0),
      centerLat: input.centerLat ?? null,
      centerLng: input.centerLng ?? null,
      polygonVertices: input.polygonVertices ?? [],
      sealedById: ctx.userId,
      sealedAt: now,
      auditTx,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "project.geofence_sealed",
      auditMetadata: {
        projectId,
        projectCode: project.code,
        type: input.type,
        radiusMeters: input.radiusMeters,
        verticesCount: input.polygonVertices?.length ?? 0,
        auditTx,
      },
      eventType: "project.geofence_sealed",
      eventPayload: {
        projectId,
        projectCode: project.code,
        type: input.type,
        radiusMeters: input.radiusMeters,
        auditTx,
      },
    });
  }

  async getGeofence(ctx: RequestUserContext, projectId: string): Promise<ProjectGeofence | null> {
    this.authz.requirePermission(ctx, READ);
    const project = await this.repository.findById(projectId);
    if (!project) throw AppError.notFound("Project not found.");
    if (!this.authz.canAccessDistrict(ctx, project.districtId)) {
      throw AppError.notFound("Project not found.");
    }
    return this.repository.findGeofenceByProjectId(projectId);
  }

  async listGeofences(ctx: RequestUserContext, projectIds?: string[]): Promise<ProjectGeofence[]> {
    this.authz.requirePermission(ctx, READ);
    return this.repository.listGeofences(projectIds);
  }

  private authorityIdOrNull(ctx: RequestUserContext): string | null {
    const authorityIds = this.authz.effectiveAuthorityIds(ctx);
    return authorityIds.size > 0 ? [...authorityIds][0]! : null;
  }
}
