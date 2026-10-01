import type { CorrectiveActionReviewOutcome, CorrectiveActionStatus } from "@netram/types";
import { CORRECTIVE_ACTION_SUBMIT_FROM } from "@netram/types";

/**
 * §32: the responsible institution lodges an Action Taken Report; the
 * authority reviews and decides. Status is a byproduct of recorded work, not a
 * user-toggled value: ATR submission (pending/rejected/overdue → submitted),
 * review start (submitted → under_review), authority verdict (submitted /
 * under_review → accepted | rejected). `overdue`/`escalated` come only from
 * the SLA job, never from users.
 */
export function canSubmitAtr(from: CorrectiveActionStatus): boolean {
  return (CORRECTIVE_ACTION_SUBMIT_FROM as readonly CorrectiveActionStatus[]).includes(from);
}

export function resolveReviewTransition(
  from: CorrectiveActionStatus,
  outcome: CorrectiveActionReviewOutcome,
): CorrectiveActionStatus {
  const allowed =
    outcome === "under_review"
      ? from === "submitted"
      : from === "submitted" || from === "under_review";
  if (!allowed) {
    throw new InvalidCorrectiveActionReviewError(from, outcome);
  }
  return outcome;
}

export class InvalidCorrectiveActionReviewError extends Error {
  constructor(from: CorrectiveActionStatus, outcome: CorrectiveActionReviewOutcome) {
    super(`Cannot record review outcome '${outcome}' on a corrective action in '${from}'`);
    this.name = "InvalidCorrectiveActionReviewError";
  }
}

/** ATR attachments are restricted to PDFs, photos, and videos (§16, §52). */
export const ATR_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type AtrAttachmentMimeType = (typeof ATR_ATTACHMENT_MIME_TYPES)[number];

export const MAX_ATR_ATTACHMENTS = 5;
export const MAX_ATR_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export function isAllowedAtrAttachmentType(mimeType: string): boolean {
  return (ATR_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}
