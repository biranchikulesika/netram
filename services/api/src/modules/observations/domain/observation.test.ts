import { describe, expect, it } from "vitest";
import {
  canAddObservation,
  InvalidObservationStageError,
  requireObservationFieldStage,
  OBSERVATION_FIELD_STAGES,
} from "./observation.js";

describe("observation field stages", () => {
  it("permits recording while the inspection is in progress or collecting evidence", () => {
    expect(canAddObservation("in_progress")).toBe(true);
    expect(canAddObservation("evidence_collection")).toBe(true);
    expect(OBSERVATION_FIELD_STAGES).toEqual(["in_progress", "evidence_collection"]);
  });

  it("rejects recording after submission, during review, or before start", () => {
    for (const status of [
      "assigned",
      "scheduled",
      "submitted",
      "under_review",
      "findings",
      "corrective_actions",
      "verification",
      "closed",
    ]) {
      expect(canAddObservation(status as Parameters<typeof canAddObservation>[0])).toBe(false);
    }
  });

  it("throws for non-field stages", () => {
    expect(() => requireObservationFieldStage("closed")).toThrow(InvalidObservationStageError);
    expect(() => requireObservationFieldStage("in_progress")).not.toThrow();
  });
});
