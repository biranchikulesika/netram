import type {
  AuditAction,
  Complaint,
  ComplaintFile,
  ComplaintStatus,
  DomainEventType,
  UUID,
} from "@netram/types";

export interface ComplaintWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface ComplaintAttachmentCommand {
  id: UUID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  storageKey: string;
}

export interface CreateComplaintCommand extends ComplaintWriteContext {
  id: UUID;
  projectId: UUID;
  complainantName: string | null;
  contactInfo: string | null;
  trackingCode: string;
  description: string;
  files?: ComplaintAttachmentCommand[];
}

export interface TransitionComplaintCommand extends ComplaintWriteContext {
  complaintId: UUID;
  to: ComplaintStatus;
  resolutionText: string | null;
}

export interface ComplaintListFilter {
  status?: ComplaintStatus;
  projectId?: UUID;
  jurisdictionIds?: UUID[];
  page: number;
  pageSize: number;
}

export interface ComplaintRepositoryPort {
  list(filter: ComplaintListFilter): Promise<{ items: Complaint[]; total: number }>;
  findById(id: UUID): Promise<Complaint | null>;
  findByTrackingCode(trackingCode: string): Promise<Complaint | null>;
  createWithAuditAndEvent(cmd: CreateComplaintCommand): Promise<Complaint>;
  transitionWithAuditAndEvent(cmd: TransitionComplaintCommand): Promise<Complaint>;
  findFileById(id: UUID): Promise<{
    file: ComplaintFile;
    complaintId: UUID;
    storageKey: string;
  } | null>;
}
