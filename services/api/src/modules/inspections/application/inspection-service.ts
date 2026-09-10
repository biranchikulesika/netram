import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { InspectionRepositoryPort } from "./ports/inspection-repository.js";
import { evaluateInspectionTransition, isDisclosedTo } from "../domain/inspection.js";
import type { Inspection, InspectionListQuery, InspectionType, OutboxRecord } from "@netram/types";

export interface EventRepositoryPort {
  listByResource(resourceType: string, resourceId: string, limit?: number): Promise<OutboxRecord[]>;
}

export interface CreateInspectionInput {
  projectId: string;
  type: InspectionType;
  trigger?: "officer" | "risk_engine" | "automatic";
  templateId?: string | null;
  disclosurePolicyId?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  assigneeUserIds?: string[];
}

const READ = "inspection:read" as const;
const CREATE = "inspection:create" as const;
const TRANSITION = "inspection:transition" as const;
const REVIEW = "inspection:review" as const;

export class InspectionService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly projectRepo: {
      findById(id: string): Promise<{
        id: string;
        districtId: string | null;
        code: string;
      } | null>;
    },
    private readonly repository: InspectionRepositoryPort,
    private readonly eventRepo: EventRepositoryPort,
  ) {}

  async listInspections(
    ctx: RequestUserContext,
    query: InspectionListQuery,
  ): Promise<{
    items: Inspection[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.authz.requirePermission(ctx, READ);

    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = this.authz.accessibleDistrictIds(ctx);
    const page = await this.repository.list({
      page: pageNum,
      pageSize,
      status: query.status,
      type: query.type,
      projectId: query.projectId,
      jurisdictionIds: scope ? [...scope] : undefined,
    });

    const isAuthorityOfficer =
      this.authz.hasPermission(ctx, REVIEW) ||
      this.authz.hasPermission(ctx, CREATE) ||
      this.authz.hasPermission(ctx, TRANSITION);
    const visible = page.items.filter((i) =>
      isDisclosedTo(i, {
        userId: ctx.userId,
        isAuthorityOfficer:
          isAuthorityOfficer || this.authz.hasPermission(ctx, "inspection:assign"),
      }),
    );
    return { items: visible, total: page.total, page: pageNum, pageSize };
  }

  async getInspection(ctx: RequestUserContext, id: string): Promise<Inspection> {
    this.authz.requirePermission(ctx, READ);
    const inspection = await this.repository.findById(id);
    if (!inspection) throw AppError.notFound("Inspection not found.");
    if (!this.authz.canAccessDistrict(ctx, inspection.districtId))
      throw AppError.notFound("Inspection not found.");

    const isAuthorityOfficer =
      this.authz.hasPermission(ctx, REVIEW) ||
      this.authz.hasPermission(ctx, CREATE) ||
      this.authz.hasPermission(ctx, TRANSITION) ||
      this.authz.hasPermission(ctx, "inspection:assign");
    if (!isDisclosedTo(inspection, { userId: ctx.userId, isAuthorityOfficer })) {
      throw AppError.notDisclosed("Inspection details are not yet disclosed.");
    }
    return inspection;
  }

  /** Durable outbox history for an inspection. Same disclosure gate as getInspection. */
  async listInspectionEvents(ctx: RequestUserContext, id: string): Promise<OutboxRecord[]> {
    await this.getInspection(ctx, id);
    return this.eventRepo.listByResource("inspection", id);
  }

  async createInspection(
    ctx: RequestUserContext,
    input: CreateInspectionInput,
  ): Promise<Inspection> {
    this.authz.requirePermission(ctx, CREATE);

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw AppError.badRequest("Project does not exist.");
    if (!this.authz.canAccessDistrict(ctx, project.districtId)) {
      throw AppError.forbidden("Project is outside your jurisdiction.");
    }

    const id = randomUUID();

    return this.repository.createWithAuditAndEvent({
      id,
      projectId: input.projectId,
      templateId: input.templateId ?? null,
      disclosurePolicyId: input.disclosurePolicyId ?? null,
      type: input.type,
      trigger: input.trigger ?? "officer",
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
      assigneeUserIds: input.assigneeUserIds ?? [],
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "inspection.created",
      auditMetadata: { projectId: input.projectId, type: input.type, id },
      eventType: "inspection.created",
      eventPayload: { projectId: input.projectId, type: input.type, id },
    });
  }

  async transitionInspection(
    ctx: RequestUserContext,
    inspectionId: string,
    to: Inspection["status"],
    note?: string,
  ): Promise<Inspection> {
    const inspection = await this.repository.findById(inspectionId);
    if (!inspection) throw AppError.notFound("Inspection not found.");
    if (!this.authz.canAccessDistrict(ctx, inspection.districtId))
      throw AppError.notFound("Inspection not found.");

    const decision = evaluateInspectionTransition(inspection.status, to);

    // §32: inspector-owned steps use inspection:transition; authority-level steps use inspection:review.
    if (decision.isInspectorStep) {
      this.authz.requirePermission(ctx, TRANSITION, {
        districtId: inspection.districtId,
      });
    } else {
      this.authz.requirePermission(ctx, REVIEW, {
        districtId: inspection.districtId,
      });
    }

    const auditMetadata: Record<string, unknown> = {
      from: inspection.status,
      to,
      note: note ?? null,
    };
    const eventPayload: Record<string, unknown> = {
      from: inspection.status,
      to,
      note: note ?? null,
    };

    return this.repository.transitionWithAuditAndEvent({
      inspectionId,
      to,
      note: note ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "inspection.transitioned",
      auditMetadata,
      eventType: this.eventTypeFor(to),
      eventPayload,
    });
  }

  private eventTypeFor(
    to: Inspection["status"],
  ): "inspection.started" | "inspection.submitted" | "inspection.status_transitioned" {
    if (to === "in_progress") return "inspection.started";
    if (to === "submitted") return "inspection.submitted";
    return "inspection.status_transitioned";
  }
}
