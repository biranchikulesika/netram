import type { FindingStatus } from "@netram/types";
import { FINDING_TRANSITIONS } from "@netram/types";

export interface FindingTransitionDecision {
  to: FindingStatus;
  /** confirm/dismiss is an authority-level finding review step (§32 boundary). */
  requiresReview: boolean;
}

/** Authority review rule: a confirmed finding moves to action_required through a corrective action (not a direct user transition). */
export function evaluateFindingTransition(
  from: FindingStatus,
  to: FindingStatus,
): FindingTransitionDecision {
  if (!FINDING_TRANSITIONS[from].includes(to)) {
    throw new InvalidFindingTransitionError(from, to);
  }
  return { to, requiresReview: true };
}

export class InvalidFindingTransitionError extends Error {
  constructor(from: FindingStatus, to: FindingStatus) {
    super(`Invalid finding transition: ${from} -> ${to}`);
    this.name = "InvalidFindingTransitionError";
  }
}

/** A corrective action may only be ordered against a finding that has been confirmed (or already has one). */
export function canOrderCorrectiveAction(finding: { status: FindingStatus }): boolean {
  return finding.status === "confirmed" || finding.status === "action_required";
}
