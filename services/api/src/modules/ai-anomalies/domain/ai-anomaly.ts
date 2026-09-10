import type { AnomalyStatus } from "@netram/types";
import { ANOMALY_TRANSITIONS } from "@netram/types";

export class InvalidAiAnomalyTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiAnomalyTransitionError";
  }
}

export function evaluateAiAnomalyTransition(
  from: AnomalyStatus,
  to: AnomalyStatus,
): { to: AnomalyStatus } {
  if (!ANOMALY_TRANSITIONS[from].includes(to)) {
    throw new InvalidAiAnomalyTransitionError(`AI anomaly cannot move from ${from} to ${to}.`);
  }
  return { to };
}
