import { AppError } from "../../../infrastructure/errors.js";

const SELF_SAFE_PERMISSIONS = ["user:manage", "role:manage"] as const;

export interface NoSelfLockoutInput {
  roleCode: string;
  currentPermissions: string[];
  requestedPermissions: string[];
  countGranters: (permission: string) => Promise<number>;
}

/**
 * Prevent removing the last grant of an administration permission, which would
 * lock the whole system out of user/role management.
 */
export async function assertNoSelfLockout(input: NoSelfLockoutInput): Promise<void> {
  for (const perm of SELF_SAFE_PERMISSIONS) {
    const wasGranted = input.currentPermissions.includes(perm);
    const stillGranted = input.requestedPermissions.includes(perm);
    if (wasGranted && !stillGranted) {
      const granters = await input.countGranters(perm);
      if (granters <= 1) {
        throw AppError.conflict(
          `Cannot remove the last '${perm}' grant from role '${input.roleCode}'.`,
        );
      }
    }
  }
}
