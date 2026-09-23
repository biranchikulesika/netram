import { randomUUID } from "node:crypto";
import type {
  InspectionSyncRepository,
  InspectionRepository,
  ObservationRepository,
  EvidenceRepository,
  FindingRepository,
} from "@netram/data";
import type {
  OfflineOperation,
  SyncBatchRequest,
  SyncBatchResponse,
  SyncOperationResult,
} from "@netram/types";
import { evaluateOfflineOperation } from "../domain/offline-operation.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";

export class InspectionSyncService {
  constructor(
    private authz: AuthorizationService,
    private inspectionRepo: InspectionRepository,
    private syncRepo: InspectionSyncRepository,
    private observationRepo: ObservationRepository,
    private evidenceRepo: EvidenceRepository,
    private findingRepo?: FindingRepository,
  ) {}

  async syncBatch(ctx: RequestUserContext, input: SyncBatchRequest): Promise<SyncBatchResponse> {
    const results: SyncOperationResult[] = [];

    for (const op of input.operations) {
      const res = await this.processSingleOperation(ctx, op);
      results.push(res);
    }

    return {
      results,
      processedAt: new Date().toISOString(),
    };
  }

  private async processSingleOperation(
    ctx: RequestUserContext,
    op: OfflineOperation,
  ): Promise<SyncOperationResult> {
    // 1. Idempotency check: if this operation was already processed, return stored result (§5, §31)
    const existing = await this.syncRepo.findById(op.operationId);
    if (existing) {
      return existing;
    }

    // 2. Fetch current inspection state
    const inspection = await this.inspectionRepo.findById(op.inspectionId);
    if (!inspection) {
      return this.syncRepo.recordResultWithAuditAndEvent({
        operationId: op.operationId,
        inspectionId: op.inspectionId,
        userId: ctx.userId,
        operationType: op.type,
        payload: op.payload as Record<string, unknown>,
        status: "rejected",
        code: "INSPECTION_NOT_FOUND",
        message: "Inspection not found.",
        clientTimestamp: op.timestamp,
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        auditAction: "inspection.operation_rejected",
        auditMetadata: {
          operationId: op.operationId,
          type: op.type,
          reason: "Inspection not found",
        },
        eventType: "inspection.operation_rejected",
        eventPayload: { operationId: op.operationId, inspectionId: op.inspectionId, type: op.type },
      });
    }

    // 3. Authorization & Assignment check: caller must be assigned to the inspection or have district authority
    const isAssigned = inspection.assignedUserIds.includes(ctx.userId);
    const hasDistrictAccess = this.authz.canAccessDistrict(ctx, inspection.districtId);
    const hasTransitionPerm = this.authz.hasPermission(ctx, "inspection:transition");

    if (!hasDistrictAccess || (!isAssigned && !hasTransitionPerm)) {
      return this.syncRepo.recordResultWithAuditAndEvent({
        operationId: op.operationId,
        inspectionId: op.inspectionId,
        userId: ctx.userId,
        operationType: op.type,
        payload: op.payload as Record<string, unknown>,
        status: "rejected",
        code: "FORBIDDEN",
        message: "User is not assigned or authorized for this inspection.",
        clientTimestamp: op.timestamp,
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        auditAction: "inspection.operation_rejected",
        auditMetadata: {
          operationId: op.operationId,
          type: op.type,
          reason: "Not authorized/assigned",
        },
        eventType: "inspection.operation_rejected",
        eventPayload: { operationId: op.operationId, inspectionId: op.inspectionId, type: op.type },
      });
    }

    // 4. Domain state evaluation (§31)
    const evaluation = evaluateOfflineOperation(inspection, op);
    if (evaluation.outcome !== "accepted") {
      return this.syncRepo.recordResultWithAuditAndEvent({
        operationId: op.operationId,
        inspectionId: op.inspectionId,
        userId: ctx.userId,
        operationType: op.type,
        payload: op.payload as Record<string, unknown>,
        status: evaluation.outcome,
        code: evaluation.code,
        message: evaluation.message,
        clientTimestamp: op.timestamp,
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        auditAction:
          evaluation.outcome === "conflict"
            ? "inspection.operation_conflict"
            : "inspection.operation_rejected",
        auditMetadata: {
          operationId: op.operationId,
          type: op.type,
          code: evaluation.code,
          reason: evaluation.message,
        },
        eventType:
          evaluation.outcome === "conflict"
            ? "inspection.operation_conflict"
            : "inspection.operation_rejected",
        eventPayload: {
          operationId: op.operationId,
          inspectionId: op.inspectionId,
          type: op.type,
          code: evaluation.code,
        },
      });
    }

    // 5. Execute state changes for accepted operations
    let resultData: Record<string, unknown> | undefined;

    switch (op.type) {
      case "start_inspection": {
        if (inspection.status !== "in_progress") {
          await this.inspectionRepo.transitionWithAuditAndEvent({
            inspectionId: op.inspectionId,
            to: "in_progress",
            note: "Started via offline sync",
            actorUserId: ctx.userId,
            requestId: ctx.requestId ?? null,
            ipAddress: ctx.ipAddress ?? null,
            auditAction: "inspection.transitioned",
            auditMetadata: {
              from: inspection.status,
              to: "in_progress",
              operationId: op.operationId,
            },
            eventType: "inspection.status_transitioned",
            eventPayload: {
              inspectionId: op.inspectionId,
              from: inspection.status,
              to: "in_progress",
            },
          });
        }
        resultData = { inspectionId: op.inspectionId, status: "in_progress" };
        break;
      }

      case "record_observation": {
        const text = String(op.payload.text ?? "");
        const observationId =
          typeof op.payload.observationId === "string" ? op.payload.observationId : randomUUID();
        const obs = await this.observationRepo.createWithAuditAndEvent({
          id: observationId,
          inspectionId: op.inspectionId,
          userId: ctx.userId,
          text,
          actorUserId: ctx.userId,
          requestId: ctx.requestId ?? null,
          ipAddress: ctx.ipAddress ?? null,
          auditAction: "observation.created",
          auditMetadata: {
            inspectionId: op.inspectionId,
            id: observationId,
            operationId: op.operationId,
          },
          eventType: "observation.created",
          eventPayload: { inspectionId: op.inspectionId, id: observationId, text },
        });
        resultData = { observationId: obs.id, inspectionId: op.inspectionId };
        break;
      }

      case "draft_finding": {
        if (!this.findingRepo) throw new Error("Finding repository is required for finding drafts.");
        const findingId = typeof op.payload.findingId === "string" ? op.payload.findingId : randomUUID();
        const finding = await this.findingRepo.createWithAuditAndEvent({
          id: findingId,
          inspectionId: op.inspectionId,
          observationId: typeof op.payload.observationId === "string" ? op.payload.observationId : null,
          severity: op.payload.severity as "critical" | "high" | "medium" | "low",
          description: String(op.payload.description ?? ""),
          remediation: typeof op.payload.remediation === "string" ? op.payload.remediation : null,
          categoryId: typeof op.payload.categoryId === "string" ? op.payload.categoryId : null,
          amountInr:
            typeof op.payload.amountInr === "number" && Number.isFinite(op.payload.amountInr)
              ? Math.trunc(op.payload.amountInr)
              : null,
          responsibleOrganisationId:
            typeof op.payload.responsibleOrganisationId === "string"
              ? op.payload.responsibleOrganisationId
              : null,
          actorUserId: ctx.userId,
          requestId: ctx.requestId ?? null,
          ipAddress: ctx.ipAddress ?? null,
          auditAction: "finding.created",
          auditMetadata: { inspectionId: op.inspectionId, operationId: op.operationId, source: "inspector_draft" },
          eventType: "finding.created",
          eventPayload: { inspectionId: op.inspectionId, findingId, source: "inspector_draft" },
        });
        resultData = { findingId: finding.id, inspectionId: op.inspectionId, status: finding.status };
        break;
      }

      case "capture_evidence": {
        const evidenceId =
          typeof op.payload.evidenceId === "string" ? op.payload.evidenceId : randomUUID();
        const ev = await this.evidenceRepo.captureWithAuditAndEvent({
          id: evidenceId,
          inspectionId: op.inspectionId,
          findingId: typeof op.payload.findingId === "string" ? op.payload.findingId : null,
          capturedAt: new Date(String(op.payload.capturedAt ?? op.timestamp)),
          latitude: typeof op.payload.latitude === "number" ? op.payload.latitude : null,
          longitude: typeof op.payload.longitude === "number" ? op.payload.longitude : null,
          evidenceType:
            (op.payload.evidenceType as "photo" | "video" | "document" | "audio") ?? "photo",
          fileName: typeof op.payload.fileName === "string" ? op.payload.fileName : null,
          mimeType: typeof op.payload.mimeType === "string" ? op.payload.mimeType : null,
          sizeBytes: typeof op.payload.fileSizeBytes === "number" ? op.payload.fileSizeBytes : null,
          contentHash: typeof op.payload.contentHash === "string" ? op.payload.contentHash : null,
          deviceId: typeof op.payload.deviceId === "string" ? op.payload.deviceId : null,
          actorUserId: ctx.userId,
          requestId: ctx.requestId ?? null,
          ipAddress: ctx.ipAddress ?? null,
          auditAction: "evidence.captured",
          auditMetadata: {
            inspectionId: op.inspectionId,
            id: evidenceId,
            contentHash: op.payload.contentHash,
            operationId: op.operationId,
          },
          eventType: "evidence.captured",
          eventPayload: {
            inspectionId: op.inspectionId,
            id: evidenceId,
            contentHash: op.payload.contentHash,
          },
        });
        resultData = {
          evidenceId: ev.id,
          inspectionId: op.inspectionId,
          contentHash: ev.contentHash,
        };
        break;
      }

      case "submit_inspection": {
        if (["in_progress", "evidence_collection"].includes(inspection.status)) {
          await this.inspectionRepo.transitionWithAuditAndEvent({
            inspectionId: op.inspectionId,
            to: "submitted",
            note: "Submitted via offline sync",
            actorUserId: ctx.userId,
            requestId: ctx.requestId ?? null,
            ipAddress: ctx.ipAddress ?? null,
            auditAction: "inspection.transitioned",
            auditMetadata: {
              from: inspection.status,
              to: "submitted",
              operationId: op.operationId,
            },
            eventType: "inspection.status_transitioned",
            eventPayload: {
              inspectionId: op.inspectionId,
              from: inspection.status,
              to: "submitted",
            },
          });
        }
        resultData = { inspectionId: op.inspectionId, status: "submitted" };
        break;
      }
    }

    return this.syncRepo.recordResultWithAuditAndEvent({
      operationId: op.operationId,
      inspectionId: op.inspectionId,
      userId: ctx.userId,
      operationType: op.type,
      payload: op.payload as Record<string, unknown>,
      status: "accepted",
      message: evaluation.message,
      resultData,
      clientTimestamp: op.timestamp,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "inspection.operation_accepted",
      auditMetadata: { operationId: op.operationId, type: op.type, resultData },
      eventType: "inspection.operation_accepted",
      eventPayload: { operationId: op.operationId, inspectionId: op.inspectionId, type: op.type },
    });
  }
}
