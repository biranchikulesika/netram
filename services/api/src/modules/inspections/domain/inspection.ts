import type { Inspection, InspectionStatus, InspectionTrigger } from "@netram/types";
import { INSPECTION_TRANSITIONS } from "@netram/types";

export interface TransitionDecision {
  to: InspectionStatus;
  /** Inspector-owned step (start/submit) vs an authority-level step (review/findings/etc). */
  isInspectorStep: boolean;
}

/**
 * Inspection workflows preserve the inspector-to-authority boundary (§32).
 * Inspector-owned transitions: moving an assigned/scheduled inspection into
 * progress and submitting collected evidence. Everything downstream (review,
 * findings, corrective actions, verification, closure) is authority-owned.
 */
const INSPECTOR_STEPS = ["in_progress", "evidence_collection", "submitted"] as const;

/**
 * Lifecycle transition evaluation. The allowed table lives in @netram/types
 * (INSPECTION_TRANSITIONS); this is the domain rule that interprets it.
 */
export function evaluateInspectionTransition(
  from: InspectionStatus,
  to: InspectionStatus,
): TransitionDecision {
  if (!INSPECTION_TRANSITIONS[from].includes(to)) {
    throw new InvalidInspectionTransitionError(from, to);
  }
  return {
    to,
    isInspectorStep: (INSPECTOR_STEPS as readonly string[]).includes(to),
  };
}

export class InvalidInspectionTransitionError extends Error {
  constructor(from: InspectionStatus, to: InspectionStatus) {
    super(`Invalid inspection transition: ${from} -> ${to}`);
    this.name = "InvalidInspectionTransitionError";
  }
}

/**
 * Disclosure (§20/§34): an inspection that has not started yet is only visible
 * to its assigned inspectors and to authority officers who manage inspections
 * (surprise-inspection protection). Started inspections are visible to any
 * inspection:read holder in jurisdiction - a set that excludes the inspected
 * organisation itself: the establishment is the oversight *subject* and holds
 * no inspection:read, so it can neither list inspections against it nor see
 * the evidence or flags arising from them. The API must NOT leak an
 * undisclosed inspection's existence to other callers.
 */
export function isDisclosedTo(
  inspection: Pick<Inspection, "status" | "assignedUserIds">,
  caller: { userId: string; isAuthorityOfficer: boolean },
): boolean {
  const hasStarted = inspection.status !== "assigned" && inspection.status !== "scheduled";
  if (hasStarted) return true;
  return caller.isAuthorityOfficer || inspection.assignedUserIds.includes(caller.userId);
}

/** Whether a caller may create an inspection for a project (uniform rule for now). */
export function canInitiateInspection(trigger: InspectionTrigger): boolean {
  return trigger === "officer" || trigger === "risk_engine";
}
