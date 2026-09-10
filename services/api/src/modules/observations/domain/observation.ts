import type { InspectionStatus } from "@netram/types";

/** Observations are field work: recordable only while the inspectors are active (§32). */
export const OBSERVATION_FIELD_STAGES: readonly InspectionStatus[] = [
  "in_progress",
  "evidence_collection",
];

export class InvalidObservationStageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidObservationStageError";
  }
}

export function canAddObservation(status: InspectionStatus): boolean {
  return (OBSERVATION_FIELD_STAGES as readonly string[]).includes(status);
}

export function requireObservationFieldStage(status: InspectionStatus): void {
  if (!canAddObservation(status)) {
    throw new InvalidObservationStageError(
      `Observations can only be recorded while the inspectors are active on site (current status: ${status}).`,
    );
  }
}
