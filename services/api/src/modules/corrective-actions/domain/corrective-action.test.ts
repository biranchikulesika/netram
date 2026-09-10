import { describe, expect, it } from "vitest";
import {
  evaluateCorrectiveActionTransition,
  InvalidCorrectiveActionTransitionError,
} from "./corrective-action.js";

describe("evaluateCorrectiveActionTransition", () => {
  it("marks submit as the institution step", () => {
    expect(evaluateCorrectiveActionTransition("pending", "submitted")).toEqual({
      to: "submitted",
      isInstitutionStep: true,
    });
  });

  it("marks acceptance/rejection as authority review steps", () => {
    expect(evaluateCorrectiveActionTransition("under_review", "accepted").isInstitutionStep).toBe(
      false,
    );
    expect(evaluateCorrectiveActionTransition("under_review", "rejected").isInstitutionStep).toBe(
      false,
    );
  });

  it("allows resubmission after rejection", () => {
    expect(evaluateCorrectiveActionTransition("rejected", "submitted").isInstitutionStep).toBe(
      true,
    );
  });

  it("rejects skipping review and terminal mutations", () => {
    expect(() => evaluateCorrectiveActionTransition("pending", "accepted")).toThrow(
      InvalidCorrectiveActionTransitionError,
    );
    expect(() => evaluateCorrectiveActionTransition("accepted", "rejected")).toThrow(
      InvalidCorrectiveActionTransitionError,
    );
    expect(() => evaluateCorrectiveActionTransition("submitted", "rejected")).toThrow(
      InvalidCorrectiveActionTransitionError,
    );
  });

  it("never allows users to jump directly to job-driven states", () => {
    expect(() => evaluateCorrectiveActionTransition("pending", "overdue")).toThrow(
      InvalidCorrectiveActionTransitionError,
    );
    expect(() => evaluateCorrectiveActionTransition("submitted", "escalated")).toThrow(
      InvalidCorrectiveActionTransitionError,
    );
  });
});
