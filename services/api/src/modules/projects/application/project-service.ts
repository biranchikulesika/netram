import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "./ports/project-repository.js";
import { evaluateTransition } from "../domain/project.js";
import type { Page, Project, ProjectListQuery, ProjectType } from "@netram/types";

export interface CreateProjectInput {
  name: string;
  type?: ProjectType;
  description?: string | null;
  organisationId?: string | null;
  districtId?: string | null;
  programmeIds?: string[];
}

const CREATE = "project:create" as const;
const READ = "project:read" as const;
const TRANSITION = "project:transition" as const;
const APPROVE = "project:approve" as const;

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

  private authorityIdOrNull(ctx: RequestUserContext): string | null {
    const authorityIds = this.authz.effectiveAuthorityIds(ctx);
    return authorityIds.size > 0 ? [...authorityIds][0]! : null;
  }
}
