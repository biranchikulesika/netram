import { describe, expect, it } from "vitest";
import { assertNoSelfLockout } from "./application/guards.js";

describe("assertNoSelfLockout", () => {
  it("removes administration permissions when another role still grants them", async () => {
    await expect(
      assertNoSelfLockout({
        roleCode: "authority_officer",
        currentPermissions: ["report:generate", "user:manage"],
        requestedPermissions: ["report:generate"],
        countGranters: async () => 2,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects removing the last user:manage grant", async () => {
    await expect(
      assertNoSelfLockout({
        roleCode: "system_admin",
        currentPermissions: ["user:manage"],
        requestedPermissions: [],
        countGranters: async () => 1,
      }),
    ).rejects.toThrow(/Cannot remove the last 'user:manage' grant/);
  });

  it("rejects removing the last role:manage grant", async () => {
    await expect(
      assertNoSelfLockout({
        roleCode: "system_admin",
        currentPermissions: ["role:manage"],
        requestedPermissions: [],
        countGranters: async () => 1,
      }),
    ).rejects.toThrow(/Cannot remove the last 'role:manage' grant/);
  });

  it("ignores unrelated and newly-added permissions", async () => {
    await expect(
      assertNoSelfLockout({
        roleCode: "inspector",
        currentPermissions: ["inspection:read"],
        requestedPermissions: ["user:manage"],
        countGranters: async () => {
          throw new Error("should not be consulted");
        },
      }),
    ).resolves.toBeUndefined();
  });
});
