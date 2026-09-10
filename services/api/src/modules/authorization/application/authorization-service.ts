import { AppError } from "../../../infrastructure/errors.js";
import type { PermissionCode } from "@netram/types";
import type { AssignmentContext } from "@netram/data";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralized, policy-based authorization.
 *
 * A decision depends on: authenticated identity + its role assignments,
 * the requested permission, and the jurisdiction of the target resource.
 * The server is always authoritative.
 */
export class AuthorizationService {
  constructor() {}

  hasPermission(ctx: Pick<RequestUserContext, "permissions">, permission: PermissionCode): boolean {
    return ctx.permissions.has(permission);
  }

  /**
   * Whether the user can access a resource located in the given district.
   * A national-scoped assignment permits everything.
   */
  canAccessDistrict(
    ctx: Pick<RequestUserContext, "assignments">,
    districtId: string | null | undefined,
  ): boolean {
    if (!districtId) return true;
    return ctx.assignments.some(
      (a) => a.allowedDistrictIds === null || a.allowedDistrictIds.has(districtId),
    );
  }

  /** Union of accessible districts; null means unrestricted (national). */
  accessibleDistrictIds(ctx: Pick<RequestUserContext, "assignments">): Set<string> | null {
    const union = new Set<string>();
    for (const a of ctx.assignments) {
      if (a.allowedDistrictIds === null) return null;
      a.allowedDistrictIds.forEach((d) => union.add(d));
    }
    return union;
  }

  effectiveAuthorityIds(ctx: Pick<RequestUserContext, "assignments">): Set<string> {
    const ids = new Set<string>();
    for (const a of ctx.assignments) if (a.authorityId) ids.add(a.authorityId);
    return ids;
  }

  requirePermission(
    ctx: Pick<RequestUserContext, "permissions" | "assignments">,
    permission: PermissionCode,
    opts?: { districtId?: string | null },
  ): void {
    if (!this.hasPermission(ctx, permission)) {
      throw AppError.forbidden(`Missing permission: ${permission}`);
    }
    if (opts?.districtId && !this.canAccessDistrict(ctx, opts.districtId)) {
      throw AppError.forbidden("Resource is outside your jurisdiction.");
    }
  }
}

export function isAssignmentNational(a: AssignmentContext): boolean {
  return a.allowedDistrictIds === null;
}
