import { describe, expect, it } from "vitest";
import { isSensitiveAction } from "./audit.js";

describe("isSensitiveAction", () => {
  it("returns true for auth actions", () => {
    expect(isSensitiveAction("auth.authenticated")).toBe(true);
    expect(isSensitiveAction("auth.authorization_failed")).toBe(true);
  });

  it("returns true for role/admin actions", () => {
    expect(isSensitiveAction("role.changed")).toBe(true);
    expect(isSensitiveAction("role.assignment_changed")).toBe(true);
    expect(isSensitiveAction("admin.action")).toBe(true);
  });

  it("returns false for normal domain actions", () => {
    expect(isSensitiveAction("project.created")).toBe(false);
    expect(isSensitiveAction("inspection.transitioned")).toBe(false);
  });
});
