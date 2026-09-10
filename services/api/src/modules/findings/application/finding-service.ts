import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { FindingRepositoryPort } from "./ports/finding-repository.js";
import type { Finding, FindingStatus, FindingSeverity } from "@netram/types";
import { evaluateFindingTransition } from "../domain/finding.js";

const REVIEW = "inspection:review" as const;

/** Findings are authority work products produced while the inspection is under review. */
const ACCEPTABLE_INSPECTION_STATUSES = ["under_review", "findings", "corrective_actions"] as const;

export interface CreateFindingInput {
  severity: FindingSeverity;
  description: string;
  remediation?: string | null;
  observationId?: string | null;
}

export class FindingService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    private readonly repository: FindingRepositoryPort,
  ) {}

  async listFindings(ctx: RequestUserContext, inspectionId: string): Promise<Finding[]> {
    await this.inspectionService.getInspection(ctx, inspectionId);
    return this.repository.listByInspection(inspectionId);
  }

  async createFinding(
    ctx: RequestUserContext,
    inspectionId: string,
    input: CreateFindingInput,
  ): Promise<Finding> {
    const inspection = await this.inspectionService.getInspection(ctx, inspectionId);
    this.authz.requirePermission(ctx, REVIEW, {
      districtId: inspection.districtId,
    });

    if (!(ACCEPTABLE_INSPECTION_STATUSES as readonly string[]).includes(inspection.status)) {
      throw AppError.conflict(
        `Findings can only be recorded while the inspection is under review (current status: ${inspection.status}).`,
      );
    }

    const id = randomUUID();
    return this.repository.createWithAuditAndEvent({
      id,
      inspectionId,
      observationId: input.observationId ?? null,
      severity: input.severity,
      description: input.description,
      remediation: input.remediation ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "finding.created",
      auditMetadata: { inspectionId, severity: input.severity },
      eventType: "finding.created",
      eventPayload: { inspectionId, severity: input.severity },
    });
  }

  async transitionFinding(
    ctx: RequestUserContext,
    findingId: string,
    to: FindingStatus,
    note?: string,
  ): Promise<Finding> {
    const finding = await this.repository.findById(findingId);
    if (!finding) throw AppError.notFound("Finding not found.");
    const inspection = await this.inspectionService.getInspection(ctx, finding.inspectionId);
    this.authz.requirePermission(ctx, REVIEW, {
      districtId: inspection.districtId,
    });

    const decision = evaluateFindingTransition(finding.status, to);

    const eventType = to === "confirmed" ? "finding.confirmed" : "finding.dismissed";
    return this.repository.transitionWithAuditAndEvent({
      findingId,
      to: decision.to,
      note: note ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "finding.transitioned",
      auditMetadata: { from: finding.status, to, note: note ?? null },
      eventType,
      eventPayload: {
        from: finding.status,
        to,
        inspectionId: finding.inspectionId,
      },
    });
  }
}
