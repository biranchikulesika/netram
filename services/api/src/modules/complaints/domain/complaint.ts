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
