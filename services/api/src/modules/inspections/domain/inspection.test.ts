import { describe, expect, it } from "vitest";
import {
  evaluateInspectionTransition,
  InvalidInspectionTransitionError,
  isDisclosedTo,
} from "./inspection.js";

describe("evaluateInspectionTransition", () => {
  it("marks inspector-owned start step", () => {
    expect(evaluateInspectionTransition("assigned", "in_progress")).toEqual({
      to: "in_progress",
      isInspectorStep: true,
    });
  });

  it("marks evidence collection as an inspector step", () => {
    expect(evaluateInspectionTransition("in_progress", "evidence_collection").isInspectorStep).toBe(
      true,
    );
  });

  it("marks submission as an inspector step", () => {
    expect(evaluateInspectionTransition("evidence_collection", "submitted").isInspectorStep).toBe(
      true,
    );
  });

  it("marks downstream review as an authority step", () => {
    expect(evaluateInspectionTransition("submitted", "under_review").isInspectorStep).toBe(false);
    expect(evaluateInspectionTransition("under_review", "findings").isInspectorStep).toBe(false);
    expect(evaluateInspectionTransition("verification", "closed").isInspectorStep).toBe(false);
  });

  it("rejects a transition that skips stages", () => {
    expect(() => evaluateInspectionTransition("assigned", "submitted")).toThrow(
      InvalidInspectionTransitionError,
    );
    expect(() => evaluateInspectionTransition("assigned", "submitted")).toThrow(
      /assigned -> submitted/,
    );
  });

  it("rejects backward or arbitrary mutation", () => {
    expect(() => evaluateInspectionTransition("submitted", "in_progress")).toThrow(
      InvalidInspectionTransitionError,
    );
    expect(() => evaluateInspectionTransition("closed", "in_progress")).toThrow(
      InvalidInspectionTransitionError,
    );
  });
});

describe("isDisclosedTo", () => {
  const notStarted = { status: "assigned" as const, assignedUserIds: ["i-1"] };

  it("shows a not-started inspection to its assigned inspector", () => {
    expect(isDisclosedTo(notStarted, { userId: "i-1", isAuthorityOfficer: false })).toBe(true);
  });

  it("shows a not-started inspection to an authority officer", () => {
    expect(isDisclosedTo(notStarted, { userId: "anyone", isAuthorityOfficer: true })).toBe(true);
  });

  it("withholds a not-started inspection from unassigned non-officers", () => {
    expect(isDisclosedTo(notStarted, { userId: "i-2", isAuthorityOfficer: false })).toBe(false);
  });

  it("always discloses a started inspection", () => {
    const started = {
      status: "in_progress" as const,
      assignedUserIds: ["i-1"],
    };
    expect(isDisclosedTo(started, { userId: "outsider", isAuthorityOfficer: false })).toBe(true);
  });
});
