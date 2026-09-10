import { randomUUID } from "node:crypto";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { ObservationRepositoryPort } from "./ports/observation-repository.js";
import type { Observation } from "@netram/types";
import { requireObservationFieldStage } from "../domain/observation.js";

const CREATE = "observation:create" as const;

export interface CreateObservationInput {
  text: string;
}

export class ObservationService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    private readonly repository: ObservationRepositoryPort,
  ) {}

  async listObservations(ctx: RequestUserContext, inspectionId: string): Promise<Observation[]> {
    await this.inspectionService.getInspection(ctx, inspectionId);
    return this.repository.listByInspection(inspectionId);
  }

  async createObservation(
    ctx: RequestUserContext,
    inspectionId: string,
    input: CreateObservationInput,
  ): Promise<Observation> {
    const inspection = await this.inspectionService.getInspection(ctx, inspectionId);
    this.authz.requirePermission(ctx, CREATE, {
      districtId: inspection.districtId,
    });
    requireObservationFieldStage(inspection.status);

    const id = randomUUID();
    return this.repository.createWithAuditAndEvent({
      id,
      inspectionId,
      userId: ctx.userId,
      text: input.text,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "observation.created",
      auditMetadata: { inspectionId, text: input.text },
      eventType: "observation.created",
      eventPayload: { inspectionId, text: input.text },
    });
  }
}
