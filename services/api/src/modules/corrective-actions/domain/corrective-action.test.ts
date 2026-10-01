import { describe, expect, it } from "vitest";
import {
  canSubmitAtr,
  InvalidCorrectiveActionReviewError,
  resolveReviewTransition,
} from "./corrective-action.js";

describe("canSubmitAtr", () => {
  it.each(["pending", "rejected", "overdue"] as const)("allows ATR submission when %s", (from) => {
    expect(canSubmitAtr(from)).toBe(true);
  });

  it.each(["submitted", "under_review", "accepted", "escalated"] as const)(
    "rejects ATR submission when %s",
    (from) => {
      expect(canSubmitAtr(from)).toBe(false);
    },
  );
});

describe("resolveReviewTransition", () => {
  it("starts review from submitted", () => {
    expect(resolveReviewTransition("submitted", "under_review")).toBe("under_review");
  });

  it("accepts from submitted or under_review", () => {
    expect(resolveReviewTransition("submitted", "accepted")).toBe("accepted");
    expect(resolveReviewTransition("under_review", "accepted")).toBe("accepted");
  });

  it("rejects from submitted or under_review", () => {
    expect(resolveReviewTransition("submitted", "rejected")).toBe("rejected");
    expect(resolveReviewTransition("under_review", "rejected")).toBe("rejected");
  });

  it("throws when the review outcome is invalid for the current status", () => {
    expect(() => resolveReviewTransition("pending", "accepted")).toThrow(
      InvalidCorrectiveActionReviewError,
    );
    expect(() => resolveReviewTransition("under_review", "under_review")).toThrow(
      InvalidCorrectiveActionReviewError,
    );
    expect(() => resolveReviewTransition("accepted", "rejected")).toThrow(
      InvalidCorrectiveActionReviewError,
    );
  });
});
