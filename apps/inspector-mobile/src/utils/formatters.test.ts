import { describe, it, expect } from "vitest";
import { formatInspectionType } from "./formatters";

describe("formatInspectionType", () => {
  it("formats standard inspection types correctly", () => {
    expect(formatInspectionType("special")).toBe("Special");
    expect(formatInspectionType("SPECIAL")).toBe("Special");
    expect(formatInspectionType("social_audit")).toBe("Social audit");
    expect(formatInspectionType("SOCIAL_AUDIT")).toBe("Social audit");
    expect(formatInspectionType("surprise")).toBe("Surprise");
    expect(formatInspectionType("SURPRISE")).toBe("Surprise");
    expect(formatInspectionType("routine")).toBe("Routine");
    expect(formatInspectionType("ROUTINE")).toBe("Routine");
    expect(formatInspectionType("follow_up")).toBe("Follow up");
  });

  it("handles null, undefined, or empty values with fallback", () => {
    expect(formatInspectionType(undefined)).toBe("Routine");
    expect(formatInspectionType(null)).toBe("Routine");
    expect(formatInspectionType("")).toBe("Routine");
  });

  it("formats unmapped types gracefully", () => {
    expect(formatInspectionType("custom_audit")).toBe("Custom audit");
  });
});
