import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AiAnomalyRepositoryPort } from "./ports/ai-anomaly-repository.js";
import type {
  AIAnomaly,
  AIAnomalyListQuery,
  AnomalyStatus,
  AuditAction,
  DomainEventType,
} from "@netram/types";
import { evaluateAiAnomalyTransition } from "../domain/ai-anomaly.js";

const READ = "ai:anomaly:read" as const;
const TRANSITION = "ai:anomaly:transition" as const;

export class AiAnomalyService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repository: AiAnomalyRepositoryPort,
    private readonly projectFinder: {
      findById(
        inspectionId: string,
      ): Promise<{ projectId: string; districtId: string | null } | null>;
    },
  ) {}

  async listAiAnomalies(
    ctx: RequestUserContext,
    query: AIAnomalyListQuery,
  ): Promise<{
    items: AIAnomaly[];
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
      type: query.type,
      severity: query.severity,
      status: query.status,
      inspectionId: query.inspectionId,
      projectId: query.projectId,
      jurisdictionIds: scope ? [...scope] : undefined,
    });
    return { items: page.items, total: page.total, page: pageNum, pageSize };
  }

  async getAiAnomaly(ctx: RequestUserContext, id: string): Promise<AIAnomaly> {
    this.authz.requirePermission(ctx, READ);
    const anomaly = await this.repository.findById(id);
    if (!anomaly) throw AppError.notFound("AI anomaly not found.");
    if (!anomaly.districtId || !this.authz.canAccessDistrict(ctx, anomaly.districtId))
      throw AppError.notFound("AI anomaly not found.");
    return anomaly;
  }

  async transitionAiAnomaly(
    ctx: RequestUserContext,
    anomalyId: string,
    to: AnomalyStatus,
    note?: string,
  ): Promise<AIAnomaly> {
    const anomaly = await this.repository.findById(anomalyId);
    if (!anomaly || !anomaly.districtId) throw AppError.notFound("AI anomaly not found.");
    this.authz.requirePermission(ctx, TRANSITION, {
      districtId: anomaly.districtId,
    });

    const decision = evaluateAiAnomalyTransition(anomaly.status, to);

    // §36 → §32: escalating to investigation operationalizes the decision by
    // creating a follow-up inspection on the anomaly's project, led by the
    // officer recording the escalation. Created atomically with the status
    // change in the repository transaction below.
    const followUpInspection =
      decision.to === "investigated"
        ? {
            id: randomUUID(),
            projectId: await this.projectIdForAnomaly(anomaly),
            assignmentId: randomUUID(),
            leadUserId: ctx.userId,
          }
        : undefined;

    const [auditAction, eventType] = this.auditAndEventFor(decision.to);
    return this.repository.transitionWithAuditAndEvent({
      anomalyId,
      to: decision.to,
      reviewedBy: ctx.userId,
      reviewedAt: new Date(),
      followUpInspection,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction,
      auditMetadata: {
        from: anomaly.status,
        to,
        ...(note ? { note } : {}),
        ...(followUpInspection ? { followUpInspectionId: followUpInspection.id } : {}),
      },
      eventType,
      eventPayload: {
        anomalyId,
        from: anomaly.status,
        to,
        type: anomaly.type,
        severity: anomaly.severity,
        ...(note ? { note } : {}),
        ...(followUpInspection ? { followUpInspectionId: followUpInspection.id } : {}),
      },
    });
  }

  private async projectIdForAnomaly(anomaly: AIAnomaly): Promise<string> {
    const project = await this.projectFinder.findById(anomaly.inspectionId);
    if (!project) {
      throw AppError.conflict(
        "Anomaly source inspection does not exist; escalation target cannot be created.",
      );
    }
    return project.projectId;
  }

  private auditAndEventFor(to: AnomalyStatus): [AuditAction, DomainEventType] {
    switch (to) {
      case "dismissed":
        return ["ai.anomaly_dismissed", "ai.anomaly_dismissed"];
      case "investigated":
        return ["ai.anomaly_investigated", "ai.anomaly_investigated"];
      case "acted_upon":
        return ["ai.anomaly_acted", "ai.anomaly_acted"];
      default:
        return ["ai.anomaly_reviewed", "ai.anomaly_reviewed"];
    }
  }
}
