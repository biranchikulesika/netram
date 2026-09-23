import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { AppError } from "../../../infrastructure/errors.js";
import type { ObjectStoragePort } from "../../../infrastructure/object-storage.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { FindingRepositoryPort } from "../../findings/application/ports/finding-repository.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { CorrectiveActionRepositoryPort } from "./ports/corrective-action-repository.js";
import type {
  CorrectiveAction,
  CorrectiveActionListQuery,
  CorrectiveActionReviewOutcome,
} from "@netram/types";
import { submitAtrSchema } from "@netram/validation";
import {
  canSubmitAtr,
  isAllowedAtrAttachmentType,
  MAX_ATR_ATTACHMENT_BYTES,
  MAX_ATR_ATTACHMENTS,
  resolveReviewTransition,
} from "../domain/corrective-action.js";
import { canOrderCorrectiveAction } from "../../findings/domain/finding.js";

const APPROVE = "corrective_action:approve" as const;
const SUBMIT = "corrective_action:submit" as const;
const READ = "corrective_action:read" as const;

export interface CreateCorrectiveActionInput {
  findingId: string;
  organisationId?: string | null;
  deadline?: string | null;
}

export interface AtrAttachmentInput {
  data: Buffer;
  fileName: string;
  mimeType: string;
}

export class CorrectiveActionService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    private readonly findingRepo: FindingRepositoryPort,
    private readonly repository: CorrectiveActionRepositoryPort,
    private readonly storage: ObjectStoragePort,
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

  /**
   * Institution lodges its Action Taken Report (§32, §16). Recording this work
   * is what automatically moves the order to `submitted` — there is no manual
   * status toggle anywhere.
   */
  async submitAtr(
    ctx: RequestUserContext,
    correctiveActionId: string,
    input: { actionSummary: string; files: AtrAttachmentInput[] },
  ): Promise<CorrectiveAction> {
    const action = await this.repository.findById(correctiveActionId);
    if (!action) throw AppError.notFound("Corrective action not found.");
    if (!this.authz.canAccessDistrict(ctx, action.districtId))
      throw AppError.notFound("Corrective action not found.");
    if (!canSubmitAtr(action.status)) {
      throw AppError.conflict(
        `An ATR can only be submitted for a pending, rejected, or overdue corrective action (current status: ${action.status}).`,
      );
    }

    this.authz.requirePermission(ctx, SUBMIT, { districtId: action.districtId });

    const { actionSummary } = submitAtrSchema.parse({ actionSummary: input.actionSummary });

    const files = input.files ?? [];
    if (files.length > MAX_ATR_ATTACHMENTS) {
      throw AppError.badRequest(
        `An ATR can carry at most ${MAX_ATR_ATTACHMENTS} attachments.`,
      );
    }
const storedFiles = await Promise.all(
      files.map(async (file): Promise<{
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        storageKey: string;
        contentHash: string;
      }> => {
        if (!isAllowedAtrAttachmentType(file.mimeType)) {
          throw AppError.badRequest(
            `Attachment '${file.fileName}' uses an unsupported type '${file.mimeType}'. Only PDF, photo, and video files are accepted.`,
          );
        }
        if (file.data.byteLength > MAX_ATR_ATTACHMENT_BYTES) {
          throw AppError.badRequest(`Attachment '${file.fileName}' exceeds the 100 MB size limit.`);
        }
        const id = randomUUID();
        const storageKey = `corrective-actions/${correctiveActionId}/${id}`;
        const contentHash = `sha256:${createHash("sha256").update(file.data).digest("hex")}`;
        await this.storage.put(storageKey, file.data, file.mimeType);
        return {
          id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.data.byteLength,
          storageKey,
          contentHash,
        };
      }),
    );

    return this.repository.applyWorkWithAuditAndEvent({
      correctiveActionId,
      to: "submitted",
      note: null,
      actionSummary,
      files: storedFiles,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "corrective_action.submitted",
      auditMetadata: {
        from: action.status,
        to: "submitted",
        attachmentCount: storedFiles.length,
      },
      eventType: "corrective_action.submitted",
      eventPayload: {
        from: action.status,
        to: "submitted",
        inspectionId: action.inspectionId,
        attachmentCount: storedFiles.length,
      },
    });
  }

  /** Stream an ATR attachment back to an authorized reader (§30 storage). */
  async getAtrFileContent(
    ctx: RequestUserContext,
    correctiveActionId: string,
    fileId: string,
  ): Promise<{
    file: { id: string; fileName: string; mimeType: string; sizeBytes: number };
    stream: Readable;
  }> {
    const action = await this.repository.findById(correctiveActionId);
    if (!action) throw AppError.notFound("Corrective action not found.");
    if (!this.authz.canAccessDistrict(ctx, action.districtId))
      throw AppError.notFound("Corrective action not found.");
    this.authz.requirePermission(ctx, READ, { districtId: action.districtId });

    const file = await this.repository.findFileById(fileId);
    if (!file || file.correctiveActionId !== correctiveActionId) {
      throw AppError.notFound("Attachment not found.");
    }
    const stream = await this.storage.get(file.storageKey);
    return { file: file.file, stream };
  }

  /**
   * Authority records its review of the submitted remediation (§24): beginning
   * review (`under_review`) or the terminal verdict (`accepted`/`rejected`).
   * The recorded decision is what advances the workflow automatically.
   */
  async reviewAction(
    ctx: RequestUserContext,
    correctiveActionId: string,
    input: { outcome: CorrectiveActionReviewOutcome; note?: string | null },
  ): Promise<CorrectiveAction> {
    const action = await this.repository.findById(correctiveActionId);
    if (!action) throw AppError.notFound("Corrective action not found.");
    if (!this.authz.canAccessDistrict(ctx, action.districtId))
      throw AppError.notFound("Corrective action not found.");

    const to = resolveReviewTransition(action.status, input.outcome);
    this.authz.requirePermission(ctx, APPROVE, { districtId: action.districtId });

    const eventType =
      to === "accepted"
        ? "corrective_action.accepted"
        : to === "rejected"
          ? "corrective_action.rejected"
          : "corrective_action.review_started";
    const auditAction =
      to === "accepted"
        ? "corrective_action.accepted"
        : to === "rejected"
          ? "corrective_action.rejected"
          : "corrective_action.updated";

    return this.repository.applyWorkWithAuditAndEvent({
      correctiveActionId,
      to,
      note: input.note ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction,
      auditMetadata: {
        from: action.status,
        to,
        note: input.note ?? null,
      },
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
