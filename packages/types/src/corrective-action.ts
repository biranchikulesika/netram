import type { UUID, ISODateTime } from "./common.js";

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
 * User-controlled corrective action lifecycle (AGENTS.md §35, §32):
 * Pending → Submitted (institution) → Under Review (authority) → Accepted /
 * Rejected. A rejected action is resubmitted by the institution.
 * `overdue` and `escalated` are produced by deadline/escalation background
 * jobs, not by direct user transitions.
 */
export const CORRECTIVE_ACTION_TRANSITIONS: Record<
  CorrectiveActionStatus,
  readonly CorrectiveActionStatus[]
> = {
  pending: ["submitted"],
  submitted: ["under_review"],
  under_review: ["accepted", "rejected"],
  accepted: [],
  rejected: ["submitted"],
  overdue: [],
  escalated: [],
};

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
  /** Human-friendly ATR reference, e.g. ATR-2026-0007. */
  atrCode: string | null;
  /** When the authority verified the submitted action. */
  verifiedAt: ISODateTime | null;
  /** Authority user who verified the submitted action. */
  verifiedByUserId: UUID | null;
  /** Reviewer remarks recorded at accept/reject time. */
  reviewRemarks: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CorrectiveActionListQuery {
  page?: number;
  pageSize?: number;
  findingId?: UUID;
  inspectionId?: UUID;
  status?: CorrectiveActionStatus;
  organisationId?: UUID;
}
