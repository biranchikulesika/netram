import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { FindingRepositoryPort } from "../../findings/application/ports/finding-repository.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { CorrectiveActionRepositoryPort } from "./ports/corrective-action-repository.js";
import type {
  CorrectiveAction,
  CorrectiveActionListQuery,
  CorrectiveActionStatus,
} from "@netram/types";
import { evaluateCorrectiveActionTransition } from "../domain/corrective-action.js";
import { canOrderCorrectiveAction } from "../../findings/domain/finding.js";

const APPROVE = "corrective_action:approve" as const;
const SUBMIT = "corrective_action:submit" as const;

export interface CreateCorrectiveActionInput {
  findingId: string;
  organisationId?: string | null;
  deadline?: string | null;
}

export class CorrectiveActionService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    private readonly findingRepo: FindingRepositoryPort,
    private readonly repository: CorrectiveActionRepositoryPort,
  ) {}

  async listCorrectiveActions(
    ctx: RequestUserContext,
    query: CorrectiveActionListQuery,
  ): Promise<{
    items: CorrectiveAction[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.authz.requirePermission(ctx, "corrective_action:read");

    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = this.authz.accessibleDistrictIds(ctx);
    const page = await this.repository.list({
      page: pageNum,
      pageSize,
      findingId: query.findingId,
      inspectionId: query.inspectionId,
      status: query.status,
      organisationId: query.organisationId,
      jurisdictionIds: scope ? [...scope] : undefined,
    });
    return { items: page.items, total: page.total, page: pageNum, pageSize };
  }

  async getCorrectiveAction(ctx: RequestUserContext, id: string): Promise<CorrectiveAction> {
    this.authz.requirePermission(ctx, "corrective_action:read");
    const action = await this.repository.findById(id);
    if (!action) throw AppError.notFound("Corrective action not found.");
    if (!this.authz.canAccessDistrict(ctx, action.districtId))
      throw AppError.notFound("Corrective action not found.");
    return action;
  }

  async createCorrectiveAction(
    ctx: RequestUserContext,
    input: CreateCorrectiveActionInput,
  ): Promise<CorrectiveAction> {
    this.authz.requirePermission(ctx, "corrective_action:read");

    const finding = await this.findingRepo.findById(input.findingId);
    if (!finding) throw AppError.notFound("Finding not found.");
    if (!canOrderCorrectiveAction(finding)) {
      throw AppError.conflict(
        `A corrective action can only be ordered for a confirmed finding (current status: ${finding.status}).`,
      );
    }

    const inspection = await this.inspectionService.getInspection(ctx, finding.inspectionId);
    this.authz.requirePermission(ctx, "inspection:review", {
      districtId: inspection.districtId,
    });

    const id = randomUUID();
    return this.repository.createWithAuditAndEvent({
      id,
      findingId: finding.id,
      inspectionId: finding.inspectionId,
      organisationId: input.organisationId ?? null,
      deadline: input.deadline ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "corrective_action.created",
      auditMetadata: {
        inspectionId: finding.inspectionId,
        findingId: finding.id,
      },
      eventType: "corrective_action.created",
      eventPayload: { inspectionId: finding.inspectionId },
    });
  }

  async transitionCorrectiveAction(
    ctx: RequestUserContext,
    correctiveActionId: string,
    to: CorrectiveActionStatus,
    note?: string,
  ): Promise<CorrectiveAction> {
    const action = await this.repository.findById(correctiveActionId);
    if (!action) throw AppError.notFound("Corrective action not found.");
    if (!this.authz.canAccessDistrict(ctx, action.districtId))
      throw AppError.notFound("Corrective action not found.");

    const decision = evaluateCorrectiveActionTransition(action.status, to);

    // §24: institution submits remediation (`corrective_action:submit`); authority reviews (`corrective_action:approve`).
    if (decision.isInstitutionStep) {
      this.authz.requirePermission(ctx, SUBMIT, {
        districtId: action.districtId,
      });
    } else {
      this.authz.requirePermission(ctx, APPROVE, {
        districtId: action.districtId,
      });
    }

    const eventType =
      to === "submitted"
        ? "corrective_action.submitted"
        : to === "accepted"
          ? "corrective_action.accepted"
          : to === "rejected"
            ? "corrective_action.rejected"
            : "corrective_action.review_started";
    const auditAction =
      to === "submitted"
        ? "corrective_action.submitted"
        : to === "accepted"
          ? "corrective_action.accepted"
          : to === "rejected"
            ? "corrective_action.rejected"
            : "corrective_action.updated";

    return this.repository.transitionWithAuditAndEvent({
      correctiveActionId,
      to: decision.to,
      note: note ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction,
      auditMetadata: { from: action.status, to, note: note ?? null },
      eventType,
      eventPayload: {
        from: action.status,
        to,
        inspectionId: action.inspectionId,
      },
    });
  }

  /**
   * Evaluates pending corrective actions against SLA deadlines (§26, §29)
   * and escalates expired ones to 'overdue'.
   */
  async markOverdueActions(actorUserId: string | null = null): Promise<{
    count: number;
    actionIds: string[];
  }> {
    return this.repository.markOverdueActions(actorUserId);
  }
}
