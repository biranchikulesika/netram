import type { ComplaintStatus } from "@netram/types";
import { COMPLAINT_TRANSITIONS } from "@netram/types";

export class InvalidComplaintTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidComplaintTransitionError";
  }
}

export function evaluateComplaintTransition(
  from: ComplaintStatus,
  to: ComplaintStatus,
): { to: ComplaintStatus } {
  if (!COMPLAINT_TRANSITIONS[from].includes(to)) {
    throw new InvalidComplaintTransitionError(`Complaint cannot move from ${from} to ${to}.`);
  }
  return { to };
}

/**
 * Grievance attachments accepted by citizens: photos, videos, PDFs and common
 * office documents (§35). Matches what the public registration portal offers.
 */
export const COMPLAINT_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type ComplaintAttachmentMimeType = (typeof COMPLAINT_ATTACHMENT_MIME_TYPES)[number];

export const MAX_COMPLAINT_ATTACHMENTS = 5;
export const MAX_COMPLAINT_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export function isAllowedComplaintAttachmentType(mimeType: string): boolean {
  return (COMPLAINT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}
