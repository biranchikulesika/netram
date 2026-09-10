import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { InspectionAssignmentRepositoryPort } from "./ports/inspection-assignment-repository.js";
import { DuplicateAssignmentError } from "@netram/data";
import type { AssignmentRole, InspectionAssignment } from "@netram/types";

const ASSIGN = "inspection:assign" as const;

export class InspectionAssignmentService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    private readonly repository: InspectionAssignmentRepositoryPort,
  ) {}

  async listAssignments(
    ctx: RequestUserContext,
    inspectionId: string,
  ): Promise<InspectionAssignment[]> {
    const inspection = await this.inspectionService.getInspection(ctx, inspectionId);
    this.authz.requirePermission(ctx, ASSIGN, {
      districtId: inspection.districtId,
    });
    return this.repository.listByInspection(inspectionId);
  }

  async listMine(
    ctx: RequestUserContext,
    page: number,
    pageSize: number,
  ): Promise<{ items: InspectionAssignment[]; total: number }> {
    return this.repository.listByUser(ctx.userId, page, pageSize);
  }

  async assignInspector(
    ctx: RequestUserContext,
    inspectionId: string,
    userId: string,
    role: AssignmentRole,
  ): Promise<InspectionAssignment> {
    const inspection = await this.inspectionService.getInspection(ctx, inspectionId);
    this.authz.requirePermission(ctx, ASSIGN, {
      districtId: inspection.districtId,
    });

    const id = randomUUID();
    try {
      return await this.repository.assignWithAuditAndEvent({
        id,
        inspectionId,
        userId,
        role,
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
      });
    } catch (err) {
      if (err instanceof DuplicateAssignmentError) throw AppError.conflict(err.message);
      throw err;
    }
  }

  async removeAssignment(ctx: RequestUserContext, assignmentId: string): Promise<void> {
    const assignment = await this.repository.findById(assignmentId);
    if (!assignment) throw AppError.notFound("Assignment not found.");
    const inspection = await this.inspectionService.getInspection(ctx, assignment.inspectionId);
    this.authz.requirePermission(ctx, ASSIGN, {
      districtId: inspection.districtId,
    });
    await this.repository.remove(assignmentId);
  }
}
