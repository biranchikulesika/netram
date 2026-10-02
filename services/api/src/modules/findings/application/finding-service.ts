import { randomUUID } from "node:crypto";
import type { UUID } from "@netram/types";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { FindingRepositoryPort } from "./ports/finding-repository.js";
import type { Finding, FindingAwaitingOrder, FindingStatus, FindingSeverity } from "@netram/types";
import { evaluateFindingTransition } from "../domain/finding.js";

const REVIEW = "inspection:review" as const;

/** Findings are authority work products produced while the inspection is under review. */
const ACCEPTABLE_INSPECTION_STATUSES = ["under_review", "findings", "corrective_actions"] as const;

export interface CreateFindingInput {
  severity: FindingSeverity;
  description: string;
  remediation?: string | null;
  observationId?: string | null;
  /** Issue category (docs/DoSJE.md §15). */
  categoryId?: string | null;
  /** Disputed/misappropriated amount in INR for financial issues. */
  amountInr?: number | null;
  /** Organisation expected to answer the issue; defaults to the target's operator. */
  responsibleOrganisationId?: string | null;
}

export class FindingService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    /**
     * Read-only access to the monitored target so a finding's responsible
     * organisation can default from the target's operator when omitted
     * (docs/DoSJE.md §14: the organisation expected to answer the issue).
     * Structural type, mirroring InspectionService's project-repo port; no
     * dependency on the projects module implementation.
     */
    private readonly projectRepo: {
      findById(id: string): Promise<{
        organisationId: UUID | null;
      } | null>;
    },
    private readonly repository: FindingRepositoryPort,
  ) {}

  async listFindings(ctx: RequestUserContext, inspectionId: string): Promise<Finding[]> {
    await this.inspectionService.getInspection(ctx, inspectionId);
    return this.repository.listByInspection(inspectionId);
  }

  /**
   * Confirmed findings across the caller's jurisdiction that are still
   * awaiting a remediation order (authority ordering surface; AGENTS.md §32).
   */
  async listFindingsAwaitingOrder(ctx: RequestUserContext): Promise<FindingAwaitingOrder[]> {
    this.authz.requirePermission(ctx, REVIEW);
    this.authz.requirePermission(ctx, "corrective_action:read");
    const scope = this.authz.accessibleDistrictIds(ctx);
    return this.repository.listAwaitingOrder(scope ? [...scope] : undefined);
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

    // ATR responsibility defaults to the operator of the audited target
    // (docs/DoSJE.md §14-16). Village-type targets have no operator, so the
    // responsible organisation stays null and the district administration
    // answers the ATR (docs/DoSJE.md §25).
    let responsibleOrganisationId = input.responsibleOrganisationId ?? null;
    if (responsibleOrganisationId === null) {
      const project = await this.projectRepo.findById(inspection.projectId);
      responsibleOrganisationId = project?.organisationId ?? null;
    }

    return this.repository.createWithAuditAndEvent({
      id,
      inspectionId,
      observationId: input.observationId ?? null,
      severity: input.severity,
      description: input.description,
      remediation: input.remediation ?? null,
      categoryId: input.categoryId ?? null,
      amountInr: input.amountInr ?? null,
      responsibleOrganisationId,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "finding.created",
      auditMetadata: {
        inspectionId,
        severity: input.severity,
        categoryId: input.categoryId ?? null,
        amountInr: input.amountInr ?? null,
      },
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
