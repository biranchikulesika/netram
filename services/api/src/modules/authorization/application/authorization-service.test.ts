import { describe, expect, it } from "vitest";
import { AuthorizationService } from "./authorization-service.js";
import { AppError } from "../../../infrastructure/errors.js";
import type { AssignmentContext } from "@netram/data";

function assignment(allowed: Set<string> | null): AssignmentContext {
  return {
    assignmentId: "a",
    roleCode: "role",
    authorityId: null,
    jurisdictionId: null,
    scope: allowed === null ? "national" : "jurisdiction",
    permissions: new Set(["project:read", "project:create"]),
    allowedDistrictIds: allowed,
  };
}

const authz = new AuthorizationService();

describe("AuthorizationService", () => {
  it("grants a permission that is present", () => {
    expect(authz.hasPermission({ permissions: new Set(["project:read"]) }, "project:read")).toBe(
      true,
    );
  });

  it("denies an absent permission", () => {
    expect(authz.hasPermission({ permissions: new Set(["project:read"]) }, "project:approve")).toBe(
      false,
    );
  });

  it("national assignment can access any district", () => {
    const ctx = { assignments: [assignment(null)] };
    expect(authz.canAccessDistrict(ctx, "district-1")).toBe(true);
    expect(authz.accessibleDistrictIds(ctx)).toBeNull();
  });

  it("district assignment cannot access another district", () => {
    const ctx = { assignments: [assignment(new Set(["district-1"]))] };
    expect(authz.canAccessDistrict(ctx, "district-1")).toBe(true);
    expect(authz.canAccessDistrict(ctx, "district-2")).toBe(false);
    expect(authz.accessibleDistrictIds(ctx)).toEqual(new Set(["district-1"]));
  });

  it("union of multiple district assignments", () => {
    const ctx = {
      assignments: [assignment(new Set(["district-1"])), assignment(new Set(["district-2"]))],
    };
    expect(authz.accessibleDistrictIds(ctx)).toEqual(new Set(["district-1", "district-2"]));
  });

  it("requirePermission throws FORBIDDEN when permission missing", () => {
    const ctx = {
      permissions: new Set<string>(),
      assignments: [assignment(null)],
    };
    expect(() => authz.requirePermission(ctx, "project:create")).toThrowError(AppError);
  });

  it("requirePermission throws FORBIDDEN for out-of-jurisdiction resource", () => {
    const ctx = {
      permissions: new Set(["project:create"]),
      assignments: [assignment(new Set(["district-1"]))],
    };
    expect(() =>
      authz.requirePermission(ctx, "project:create", {
        districtId: "district-2",
      }),
    ).toThrowError(AppError);
  });
});
