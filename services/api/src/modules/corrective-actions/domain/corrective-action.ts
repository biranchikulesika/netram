import type { CorrectiveActionStatus } from "@netram/types";
import { CORRECTIVE_ACTION_TRANSITIONS } from "@netram/types";

export interface CorrectiveActionTransitionDecision {
  to: CorrectiveActionStatus;
  /** Institution-owned step (submit/resubmit remediation) vs authority review. */
  isInstitutionStep: boolean;
}

/**
 * §24: institutions submit remediation; authority reviews and accepts/rejects.
 * `overdue`/`escalated` are job-driven and never user-initiated.
 */
export function evaluateCorrectiveActionTransition(
  from: CorrectiveActionStatus,
  to: CorrectiveActionStatus,
): CorrectiveActionTransitionDecision {
  if (!CORRECTIVE_ACTION_TRANSITIONS[from].includes(to)) {
    throw new InvalidCorrectiveActionTransitionError(from, to);
  }
  return {
    to,
    isInstitutionStep: to === "submitted",
  };
}

export class InvalidCorrectiveActionTransitionError extends Error {
  constructor(from: CorrectiveActionStatus, to: CorrectiveActionStatus) {
    super(`Invalid corrective action transition: ${from} -> ${to}`);
    this.name = "InvalidCorrectiveActionTransitionError";
  }
}
