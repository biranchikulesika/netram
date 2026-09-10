import { describe, expect, it } from "vitest";
import {
  evaluateFindingTransition,
  InvalidFindingTransitionError,
  canOrderCorrectiveAction,
} from "./finding.js";

describe("evaluateFindingTransition", () => {
  it("allows authority to confirm or dismiss a new finding", () => {
    expect(evaluateFindingTransition("new", "confirmed")).toEqual({
      to: "confirmed",
      requiresReview: true,
    });
    expect(evaluateFindingTransition("new", "dismissed")).toEqual({
      to: "dismissed",
      requiresReview: true,
    });
  });

  it("marks confirmed -> action_required as the internal corrective-action path", () => {
    expect(evaluateFindingTransition("confirmed", "action_required")).toEqual({
      to: "action_required",
      requiresReview: true,
    });
  });

  it("rejects dismiss/re-confirm of terminal states", () => {
    expect(() => evaluateFindingTransition("dismissed", "confirmed")).toThrow(
      InvalidFindingTransitionError,
    );
    expect(() => evaluateFindingTransition("action_required", "new")).toThrow(
      InvalidFindingTransitionError,
    );
  });
});

describe("canOrderCorrectiveAction", () => {
  it("allows ordering against confirmed findings only", () => {
    expect(canOrderCorrectiveAction({ status: "confirmed" })).toBe(true);
    expect(canOrderCorrectiveAction({ status: "action_required" })).toBe(true);
    expect(canOrderCorrectiveAction({ status: "new" })).toBe(false);
    expect(canOrderCorrectiveAction({ status: "dismissed" })).toBe(false);
  });
});
