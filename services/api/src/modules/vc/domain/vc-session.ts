import type { VcSessionStatus, VcParticipantRole } from "@netram/types";

export const VC_SESSION_TRANSITIONS: Record<VcSessionStatus, VcSessionStatus[]> = {
  scheduled: ["active", "cancelled"],
  active: ["completed"],
  completed: [],
  cancelled: [],
};

export class InvalidVcSessionTransitionError extends Error {
  constructor(from: VcSessionStatus, to: VcSessionStatus) {
    super(`Cannot transition VC session from '${from}' to '${to}'`);
    this.name = "InvalidVcSessionTransitionError";
  }
}

export function validateVcTransition(from: VcSessionStatus, to: VcSessionStatus): void {
  const allowed = VC_SESSION_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidVcSessionTransitionError(from, to);
  }
}

export function isSessionJoinable(status: VcSessionStatus): boolean {
  // Participants can join scheduled sessions (waiting room) or active sessions
  return status === "scheduled" || status === "active";
}

export function determineParticipantRole(
  userId: string,
  hostUserId: string | null | undefined,
  requestedRole?: VcParticipantRole,
  isInspector?: boolean,
  isOrganisationRep?: boolean,
): VcParticipantRole {
  if (userId === hostUserId) {
    return "host";
  }
  if (requestedRole) {
    return requestedRole;
  }
  if (isInspector) {
    return "inspector";
  }
  if (isOrganisationRep) {
    return "organisation_rep";
  }
  return "observer";
}
