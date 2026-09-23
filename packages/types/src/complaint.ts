import type { UUID, ISODateTime } from "./common.js";

/**
 * A complaint is an oversight input (§35). It is NOT automatically equivalent
 * to confirmed misconduct or an automatic inspection; the authority decides
 * the outcome (review, escalation, resolution, or no action).
 */
export const COMPLAINT_STATUSES = [
  "received",
  "under_review",
  "escalated",
  "resolved",
  "closed",
] as const;

export const COMPLAINT_TRANSITIONS: Record<
  (typeof COMPLAINT_STATUSES)[number],
  readonly (typeof COMPLAINT_STATUSES)[number][]
> = {
  received: ["under_review"],
  under_review: ["escalated", "resolved", "closed"],
  escalated: ["resolved", "closed"],
  resolved: [],
  closed: [],
};

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

/**
 * A supporting attachment (PDF, photo, video, doc) lodged with a grievance.
 * The blob lives in object storage; only metadata is persisted (§30).
 */
export interface ComplaintFile {
  id: UUID;
  complaintId: UUID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  createdAt: ISODateTime;
}

export interface Complaint {
  id: UUID;
  projectId: UUID;
  projectCode: string;
  projectName: string;
  districtId: UUID | null;
  complainantName: string | null;
  contactInfo: string | null;
  trackingCode: string;
  description: string;
  status: ComplaintStatus;
  receivedAt: ISODateTime;
  resolutionText: string | null;
  resolvedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Supporting attachments lodged with the grievance (object metadata only, §30). */
  files: ComplaintFile[];
}

export interface ComplaintListQuery {
  page?: number;
  pageSize?: number;
  status?: ComplaintStatus;
  projectId?: UUID;
}

export interface PublicComplaintTracking {
  trackingCode: string;
  projectCode: string;
  projectName: string;
  status: ComplaintStatus;
  receivedAt: ISODateTime;
  resolvedAt: ISODateTime | null;
  resolutionText: string | null;
}
