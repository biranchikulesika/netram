import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { ComplaintRepositoryPort } from "./ports/complaint-repository.js";
import type {
  Complaint,
  ComplaintListQuery,
  ComplaintStatus,
  AuditAction,
  DomainEventType,
} from "@netram/types";
import { evaluateComplaintTransition } from "../domain/complaint.js";

const READ = "complaint:read" as const;
const CREATE = "complaint:create" as const;
const RESOLVE = "complaint:resolve" as const;

export interface CreateComplaintInput {
  projectId: string;
  description: string;
  complainantName?: string;
  contactInfo?: string;
}

function newTrackingCode(): string {
  return `CMP-${new Date().getUTCFullYear()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export class ComplaintService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly projectRepo: Pick<ProjectRepositoryPort, "findById">,
    private readonly repository: ComplaintRepositoryPort,
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

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw AppError.badRequest("Project does not exist.");

    const id = randomUUID();
    const trackingCode = newTrackingCode();
    return this.repository.createWithAuditAndEvent({
      id,
      projectId: input.projectId,
      complainantName: input.complainantName ?? null,
      contactInfo: input.contactInfo ?? null,
      trackingCode,
      description: input.description,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "complaint.submitted",
      auditMetadata: { projectId: input.projectId },
      eventType: "complaint.submitted",
      eventPayload: {
        complaintId: id,
        projectId: input.projectId,
        trackingCode,
      },
    });
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
