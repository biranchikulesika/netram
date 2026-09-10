import type { ReportStatus } from "@netram/types";
import { REPORT_TRANSITIONS } from "@netram/types";

export class InvalidReportTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReportTransitionError";
  }
}

export function evaluateReportTransition(
  from: ReportStatus,
  to: ReportStatus,
): { to: ReportStatus } {
  if (!REPORT_TRANSITIONS[from].includes(to)) {
    throw new InvalidReportTransitionError(`Report cannot move from ${from} to ${to}.`);
  }
  return { to };
}
