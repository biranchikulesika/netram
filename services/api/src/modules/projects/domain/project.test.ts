import { describe, expect, it } from "vitest";
import { evaluateTransition, InvalidTransitionError, isSelfApproval } from "./project.js";

describe("evaluateTransition", () => {
  it("allows a forward lifecycle transition", () => {
    expect(evaluateTransition("Draft", "Pending Verification")).toEqual({
      to: "Pending Verification",
      requiresApproval: false,
    });
  });

  it("marks approval transitions", () => {
    expect(evaluateTransition("Pending Verification", "Approved")).toEqual({
      to: "Approved",
      requiresApproval: true,
    });
  });

  it("allows suspension and reactivation", () => {
    expect(evaluateTransition("Active", "Suspended").to).toBe("Suspended");
    expect(evaluateTransition("Suspended", "Active").to).toBe("Active");
  });

  it("rejects a skips over intermediate states", () => {
    expect(() => evaluateTransition("Draft", "Active")).toThrow(InvalidTransitionError);
    expect(() => evaluateTransition("Draft", "Active")).toThrow(/Draft -> Active/);
  });

  it("rejects arbitrary mutation from archived", () => {
    expect(() => evaluateTransition("Archived", "Active")).toThrow(InvalidTransitionError);
  });
});

describe("isSelfApproval", () => {
  it("defers self-approval prohibition to the permission model", () => {
    expect(isSelfApproval("org-1", "auth-1", "auth-1")).toBe(false);
  });
});
