import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { AppError } from "../../../infrastructure/errors.js";
import type { ObjectStoragePort } from "../../../infrastructure/object-storage.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { EvidenceRepositoryPort } from "./ports/evidence-repository.js";
import type { Evidence, EvidenceType } from "@netram/types";
import {
  decideIntegrityAfterUpload,
  evaluateEvidenceIntegrity,
  evaluateEvidenceUpload,
} from "../domain/evidence.js";
import type { InspectionStatus } from "@netram/types";

const CREATE = "evidence:create" as const;

/** §30: evidence is captured during field work, like observations. */
const EVIDENCE_FIELD_STAGES = new Set<InspectionStatus>(["in_progress", "evidence_collection"]);

export interface CaptureEvidenceInput {
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  evidenceType: EvidenceType;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  contentHash?: string | null;
  deviceId?: string;
  findingId?: string | null;
}

export interface UploadEvidenceInput {
  data: Buffer;
  fileName?: string | null;
  mimeType?: string | null;
}

export class EvidenceService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    private readonly repository: EvidenceRepositoryPort,
    private readonly storage: ObjectStoragePort,
  ) {}

  async listEvidence(ctx: RequestUserContext, inspectionId: string): Promise<Evidence[]> {
    await this.inspectionService.getInspection(ctx, inspectionId);
    return this.repository.listByInspection(inspectionId);
  }

  async captureEvidence(
    ctx: RequestUserContext,
    inspectionId: string,
    input: CaptureEvidenceInput,
  ): Promise<Evidence> {
    const inspection = await this.inspectionService.getInspection(ctx, inspectionId);
    this.authz.requirePermission(ctx, CREATE, {
      districtId: inspection.districtId,
    });

    if (!EVIDENCE_FIELD_STAGES.has(inspection.status as InspectionStatus)) {
      throw AppError.conflict(
        `Evidence can only be captured while the inspectors are active on site (current status: ${inspection.status}).`,
      );
    }

    const id = randomUUID();
    return this.repository.captureWithAuditAndEvent({
      id,
      inspectionId,
      findingId: input.findingId ?? null,
      capturedAt: new Date(input.capturedAt),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      evidenceType: input.evidenceType,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      contentHash: input.contentHash ?? null,
      deviceId: input.deviceId ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "evidence.captured",
      auditMetadata: { inspectionId, evidenceType: input.evidenceType },
      eventType: "evidence.captured",
      eventPayload: { inspectionId, evidenceType: input.evidenceType },
    });
  }

  /**
   * Real upload: the server hashes the received bytes itself and compares them
   * against the capture-time hash (§30). The hash proves byte equality with the
   * previously hashed content - nothing more.
   */
  async uploadEvidence(
    ctx: RequestUserContext,
    evidenceId: string,
    input: UploadEvidenceInput,
  ): Promise<Evidence> {
    const current = await this.repository.findById(evidenceId);
    if (!current) throw AppError.notFound("Evidence not found.");
    const inspection = await this.inspectionService.getInspection(ctx, current.inspectionId);
    this.authz.requirePermission(ctx, CREATE, {
      districtId: inspection.districtId,
    });

    evaluateEvidenceUpload(current.uploadState, "uploaded");

    const computedHash = `sha256:${createHash("sha256").update(input.data).digest("hex")}`;
    const integrityTo = decideIntegrityAfterUpload(current.contentHash, computedHash);
    if (integrityTo !== null) evaluateEvidenceIntegrity(current.integrityState, integrityTo, true);

    const storageKey = `evidence/${current.inspectionId}/${evidenceId}`;
    await this.storage.put(storageKey, input.data, input.mimeType ?? null);

    const verified = integrityTo === "verified";
    const failed = integrityTo === "mismatch";
    const withStoredHash = current.contentHash === null ? computedHash : current.contentHash;

    return this.repository.markUploadedWithAuditAndEvent({
      evidenceId,
      contentHash: withStoredHash,
      storageKey,
      fileName: input.fileName ?? current.fileName ?? undefined,
      mimeType: input.mimeType ?? current.mimeType ?? undefined,
      sizeBytes: input.data.byteLength,
      integrityTo: integrityTo ?? undefined,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: verified
        ? "evidence.verified"
        : failed
          ? "evidence.integrity_failed"
          : "evidence.uploaded",
      auditMetadata: {
        inspectionId: current.inspectionId,
        computedHash,
        storedHash: current.contentHash,
        matched: verified,
      },
      eventType: verified
        ? "evidence.verified"
        : failed
          ? "evidence.integrity_failed"
          : "evidence.uploaded",
      eventPayload: {
        inspectionId: current.inspectionId,
        computedHash,
        matched: verified,
        integrityTo,
      },
    });
  }

  /** Stream the object back to an authorized client for inspection/re-checks. */
  async getEvidenceContent(
    ctx: RequestUserContext,
    evidenceId: string,
  ): Promise<{ evidence: Evidence; stream: Readable }> {
    const current = await this.repository.findById(evidenceId);
    if (!current) throw AppError.notFound("Evidence not found.");
    if (!current.storageKey) throw AppError.conflict("Evidence object has not been uploaded yet.");
    const inspection = await this.inspectionService.getInspection(ctx, current.inspectionId);
    this.authz.requirePermission(ctx, CREATE, {
      districtId: inspection.districtId,
    });
    const stream = await this.storage.get(current.storageKey);
    return { evidence: current, stream };
  }

  async verifyIntegrity(
    ctx: RequestUserContext,
    evidenceId: string,
    submittedHash: string,
  ): Promise<Evidence> {
    const current = await this.repository.findById(evidenceId);
    if (!current) throw AppError.notFound("Evidence not found.");
    const inspection = await this.inspectionService.getInspection(ctx, current.inspectionId);
    this.authz.requirePermission(ctx, CREATE, {
      districtId: inspection.districtId,
    });

    const isUploaded = current.uploadState === "uploaded";
    const matches =
      isUploaded && current.contentHash !== null && current.contentHash === submittedHash;
    const to = matches ? "verified" : "mismatch";

    const decision = evaluateEvidenceIntegrity(current.integrityState, to, isUploaded);

    const verified = decision.to === "verified";
    return this.repository.verifyIntegrityWithAuditAndEvent({
      evidenceId,
      to: decision.to,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: verified ? "evidence.verified" : "evidence.integrity_failed",
      auditMetadata: {
        inspectionId: current.inspectionId,
        submittedHash,
        storedHash: current.contentHash,
        matched: matches,
      },
      eventType: verified ? "evidence.verified" : "evidence.integrity_failed",
      eventPayload: { inspectionId: current.inspectionId, matched: matches },
    });
  }
}
