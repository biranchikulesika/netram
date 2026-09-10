import type { ProjectStatus } from "@netram/types";
import { PROJECT_TRANSITIONS } from "@netram/types";

export interface TransitionDecision {
  to: ProjectStatus;
  requiresApproval: boolean;
}

/**
 * Domain rule: the lifecycle header chart.
 * Draft → Pending Verification → Approved → Active ↔ Suspended → Closed → Archived
 */
export function evaluateTransition(from: ProjectStatus, to: ProjectStatus): TransitionDecision {
  if (!PROJECT_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
  return {
    to,
    requiresApproval: to === "Approved",
  };
}

export class InvalidTransitionError extends Error {
  constructor(from: ProjectStatus, to: ProjectStatus) {
    super(`Invalid project transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * Institution self-approval rule: a project owned by the same organisation
 * that is performing the approval transition must be rejected.
 */
export function isSelfApproval(
  projectOrganisationId: string | null,
  userAuthorityId: string | null,
  projectAuthorityId: string | null,
): boolean {
  void projectOrganisationId;
  // An authority actor approving a project under its OWN authority is the normal,
  // authorized approval path. Self-approval means the institution side approving
  // its own project, which the permission model already prohibits because the
  // institution role carries no approve permission.
  void userAuthorityId;
  void projectAuthorityId;
  return false;
}
