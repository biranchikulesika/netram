import { describe, expect, it } from "vitest";
import { evaluateComplaintTransition, InvalidComplaintTransitionError } from "./complaint.js";

describe("evaluateComplaintTransition", () => {
  it("allows the prescribed oversight flow", () => {
    expect(evaluateComplaintTransition("received", "under_review").to).toBe("under_review");
    expect(evaluateComplaintTransition("under_review", "escalated").to).toBe("escalated");
    expect(evaluateComplaintTransition("under_review", "resolved").to).toBe("resolved");
    expect(evaluateComplaintTransition("under_review", "closed").to).toBe("closed");
    expect(evaluateComplaintTransition("escalated", "resolved").to).toBe("resolved");
    expect(evaluateComplaintTransition("escalated", "closed").to).toBe("closed");
  });

  it("rejects skipping review, escalating straight from received, and terminal mutations", () => {
    expect(() => evaluateComplaintTransition("received", "resolved")).toThrow(
      InvalidComplaintTransitionError,
    );
    expect(() => evaluateComplaintTransition("received", "escalated")).toThrow(
      InvalidComplaintTransitionError,
    );
    expect(() => evaluateComplaintTransition("resolved", "under_review")).toThrow(
      InvalidComplaintTransitionError,
    );
    expect(() => evaluateComplaintTransition("closed", "resolved")).toThrow(
      InvalidComplaintTransitionError,
    );
  });
});
