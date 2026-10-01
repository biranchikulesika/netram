import type { UUID, ISODateTime } from "./common.js";
import type { FindingSeverity } from "./finding.js";

export const CORRECTIVE_ACTION_STATUSES = [
  "pending",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "overdue",
  "escalated",
] as const;

export type CorrectiveActionStatus = (typeof CORRECTIVE_ACTION_STATUSES)[number];

/**
 * §32, §35: corrective action status is DERIVED from recorded work, never
 * toggled manually. The institution's ATR submission is the only way an order
 * leaves `pending`; authority review + decision drive `under_review` →
 * `accepted`/`rejected`; the SLA job drives `overdue`.
 */
export const CORRECTIVE_ACTION_SUBMIT_FROM = ["pending", "rejected", "overdue"] as const;

export const CORRECTIVE_ACTION_REVIEW_OUTCOMES = ["under_review", "accepted", "rejected"] as const;

export type CorrectiveActionReviewOutcome = (typeof CORRECTIVE_ACTION_REVIEW_OUTCOMES)[number];

/**
 * Facility context resolved for a corrective action (populated on list
 * responses so table/cards/map views can render without extra lookups).
 */
export interface CorrectiveActionProject {
  id: UUID;
  code: string;
  name: string;
  districtId: UUID | null;
  /** District name resolved at read time. */
  districtName: string | null;
  stateName: string | null;
  /** May embed "GPS Coordinates: lat, lng" for map fallback positioning. */
  description: string | null;
}

/**
 * The confirmed finding this corrective action must remediate. Populated on
 * list responses so the reference cell renders without extra lookups.
 */
export interface CorrectiveActionFinding {
  id: UUID;
  severity: FindingSeverity;
  description: string;
  categoryId: UUID | null;
  categoryName: string | null;
}

/**
 * A supporting attachment (PDF, photo, video) lodged with the Action Taken
 * Report. The blob lives in object storage; only metadata is persisted.
 */
export interface CorrectiveActionFile {
  id: UUID;
  correctiveActionId: UUID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  createdAt: ISODateTime;
}

export interface CorrectiveAction {
  id: UUID;
  findingId: UUID;
  inspectionId: UUID;
  /** Organisation responsible for submitting the action/ATR. */
  organisationId: UUID | null;
  status: CorrectiveActionStatus;
  deadline: ISODateTime | null;
  submittedAt: ISODateTime | null;
  /**
   * Action Taken Report content (docs/DoSJE.md §16): what the responsible
   * organisation actually did, not merely that something was submitted.
   */
  actionSummary: string | null;
  /** Attachments lodged with the ATR (object metadata only, §30). */
  atrFiles: CorrectiveActionFile[];
  /** When the authority verified the submitted action. */
  verifiedAt: ISODateTime | null;
  /** Authority user who verified the submitted action. */
  verifiedByUserId: UUID | null;
  /** Reviewer remarks recorded at accept/reject time. */
  reviewRemarks: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Related facility; null when no project context is resolvable. */
  project: CorrectiveActionProject | null;
  /** Related confirmed finding; null when no finding context is resolvable. */
  finding: CorrectiveActionFinding | null;
}

export interface CorrectiveActionListQuery {
  page?: number;
  pageSize?: number;
  findingId?: UUID;
  inspectionId?: UUID;
  status?: CorrectiveActionStatus;
  organisationId?: UUID;
}
