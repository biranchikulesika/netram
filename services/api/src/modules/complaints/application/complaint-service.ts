import { randomBytes, randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { AppError } from "../../../infrastructure/errors.js";
import type { ObjectStoragePort } from "../../../infrastructure/object-storage.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { ComplaintRepositoryPort } from "./ports/complaint-repository.js";
import type {
  Complaint,
  ComplaintFile,
  ComplaintListQuery,
  ComplaintStatus,
  PublicComplaintTracking,
  AuditAction,
  DomainEventType,
} from "@netram/types";
import { evaluateComplaintTransition } from "../domain/complaint.js";
import {
  isAllowedComplaintAttachmentType,
  MAX_COMPLAINT_ATTACHMENTS,
  MAX_COMPLAINT_ATTACHMENT_BYTES,
} from "../domain/complaint.js";

const READ = "complaint:read" as const;
const CREATE = "complaint:create" as const;
const RESOLVE = "complaint:resolve" as const;

export interface CreateComplaintInput {
  projectId: string;
  description: string;
  complainantName?: string;
  contactInfo?: string;
}

export interface ComplaintAttachmentInput {
  data: Buffer;
  fileName: string;
  mimeType: string;
}

function newTrackingCode(): string {
  return `CMP-${new Date().getUTCFullYear()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export class ComplaintService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly projectRepo: Pick<ProjectRepositoryPort, "findById">,
    private readonly repository: ComplaintRepositoryPort,
    private readonly storage: ObjectStoragePort,
  ) {}

  async listComplaints(
    ctx: RequestUserContext,
    query: ComplaintListQuery,
  ): Promise<{
    items: Complaint[];
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
      projectId: query.projectId,
      jurisdictionIds: scope ? [...scope] : undefined,
    });
    return { items: page.items, total: page.total, page: pageNum, pageSize };
  }

  async getComplaint(ctx: RequestUserContext, id: string): Promise<Complaint> {
    this.authz.requirePermission(ctx, READ);
    const complaint = await this.repository.findById(id);
    if (!complaint) throw AppError.notFound("Complaint not found.");
    if (!this.authz.canAccessDistrict(ctx, complaint.districtId))
      throw AppError.notFound("Complaint not found.");
    return complaint;
  }

  async createComplaint(ctx: RequestUserContext, input: CreateComplaintInput): Promise<Complaint> {
    this.authz.requirePermission(ctx, CREATE);
    return this.persistComplaint(input, [], ctx.userId, ctx.requestId ?? null, ctx.ipAddress ?? null);
  }

  /**
   * Public (citizen) grievance registration used by the citizen portal. Server
   * remains authoritative: the project must exist, input is still validated at
   * the HTTP boundary, optional attachments are type/size checked and hashed
   * server-side, and the submission is audited (§35).
   */
  async createPublicComplaint(
    input: CreateComplaintInput,
    files: ComplaintAttachmentInput[],
    requestId: string | null,
    ipAddress: string | null,
  ): Promise<Complaint> {
    return this.persistComplaint(input, files, null, requestId, ipAddress);
  }

  private async persistComplaint(
    input: CreateComplaintInput,
    files: ComplaintAttachmentInput[],
    actorUserId: string | null,
    requestId: string | null,
    ipAddress: string | null,
  ): Promise<Complaint> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw AppError.badRequest("Project does not exist.");

    if (files.length > MAX_COMPLAINT_ATTACHMENTS) {
      throw AppError.badRequest(
        `A grievance can carry at most ${MAX_COMPLAINT_ATTACHMENTS} attachments.`,
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
        if (!isAllowedComplaintAttachmentType(file.mimeType)) {
          throw AppError.badRequest(
            `Attachment '${file.fileName}' uses an unsupported type '${file.mimeType}'. Only photos, videos, PDFs and office documents are accepted.`,
          );
        }
        if (file.data.byteLength > MAX_COMPLAINT_ATTACHMENT_BYTES) {
          throw AppError.badRequest(
            `Attachment '${file.fileName}' exceeds the 100 MB size limit.`,
          );
        }
        const id = randomUUID();
        const storageKey = `complaints/${id}`;
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

    const id = randomUUID();
    const trackingCode = newTrackingCode();
    return this.repository.createWithAuditAndEvent({
      id,
      projectId: input.projectId,
      complainantName: input.complainantName ?? null,
      contactInfo: input.contactInfo ?? null,
      trackingCode,
      description: input.description,
      files: storedFiles,
      actorUserId,
      requestId,
      ipAddress,
      auditAction: "complaint.submitted",
      auditMetadata: { projectId: input.projectId, attachmentCount: storedFiles.length },
      eventType: "complaint.submitted",
      eventPayload: {
        complaintId: id,
        projectId: input.projectId,
        trackingCode,
        attachmentCount: storedFiles.length,
      },
    });
  }

  /** Stream a grievance attachment back to an authorized reader (§30 storage). */
  async getComplaintFileContent(
    ctx: RequestUserContext,
    complaintId: string,
    fileId: string,
  ): Promise<{ file: ComplaintFile; stream: Readable }> {
    const complaint = await this.repository.findById(complaintId);
    if (!complaint) throw AppError.notFound("Complaint not found.");
    if (!this.authz.canAccessDistrict(ctx, complaint.districtId))
      throw AppError.notFound("Complaint not found.");
    this.authz.requirePermission(ctx, READ, { districtId: complaint.districtId });

    const file = await this.repository.findFileById(fileId);
    if (!file || file.complaintId !== complaintId) {
      throw AppError.notFound("Attachment not found.");
    }
    const stream = await this.storage.get(file.storageKey);
    return { file: file.file, stream };
  }

  async transitionComplaint(
    ctx: RequestUserContext,
    complaintId: string,
    to: ComplaintStatus,
    resolutionText?: string,
  ): Promise<Complaint> {
    const complaint = await this.repository.findById(complaintId);
    if (!complaint) throw AppError.notFound("Complaint not found.");
    this.authz.requirePermission(ctx, RESOLVE, {
      districtId: complaint.districtId,
    });

    if (to === "resolved" && !resolutionText) {
      throw AppError.badRequest("Resolution requires resolutionText.");
    }

    const decision = evaluateComplaintTransition(complaint.status, to);

    const [auditAction, eventType] = this.auditAndEventFor(decision.to);
    return this.repository.transitionWithAuditAndEvent({
      complaintId,
      to: decision.to,
      resolutionText: resolutionText ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction,
      auditMetadata: {
        from: complaint.status,
        to,
        resolutionText: resolutionText ?? null,
      },
      eventType,
      eventPayload: {
        complaintId,
        from: complaint.status,
        to,
        trackingCode: complaint.trackingCode,
      },
    });
  }

  async trackComplaint(trackingCode: string): Promise<PublicComplaintTracking> {
    const complaint = await this.repository.findByTrackingCode(trackingCode);
    if (!complaint) throw AppError.notFound("No complaint found for this tracking code.");
    return {
      trackingCode: complaint.trackingCode,
      projectCode: complaint.projectCode,
      projectName: complaint.projectName,
      status: complaint.status,
      receivedAt: complaint.receivedAt,
      resolvedAt: complaint.resolvedAt,
      resolutionText: complaint.resolutionText,
    };
  }

  private auditAndEventFor(to: ComplaintStatus): [AuditAction, DomainEventType] {
    switch (to) {
      case "resolved":
        return ["complaint.resolved", "complaint.resolved"];
      case "escalated":
        return ["complaint.escalated", "complaint.escalated"];
      case "closed":
        return ["complaint.closed", "complaint.closed"];
      default:
        return ["complaint.updated", "complaint.updated"];
    }
  }
}
