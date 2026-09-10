import { eq } from "drizzle-orm";
import {
  roleAssignments,
  roles,
  rolePermissions,
  jurisdictions,
  districts,
  states,
  countries,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";

export interface AssignmentContext {
  assignmentId: string;
  roleCode: string;
  authorityId: string | null;
  jurisdictionId: string | null;
  scope: string;
  permissions: Set<string>;
  /** null means unrestricted by jurisdiction (national coverage). */
  allowedDistrictIds: Set<string> | null;
}

export interface UserAuthorizationContextData {
  userId: string;
  assignments: AssignmentContext[];
  allPermissions: Set<string>;
}

/**
 * Resolves a user's effective authorization context from the database:
 * role assignments, combined permissions, and the concrete district set each
 * assignment covers (national = all districts).
 */
export class AuthorizationRepository {
  constructor(private db: DrizzleDB) {}

  async getContext(userId: string): Promise<UserAuthorizationContextData> {
    const assignments = await this.db
      .select({
        assignmentId: roleAssignments.id,
        roleCode: roleAssignments.roleCode,
        authorityId: roleAssignments.authorityId,
        jurisdictionId: roleAssignments.jurisdictionId,
        scope: roleAssignments.scope,
        permissionCode: rolePermissions.permissionCode,
      })
      .from(roleAssignments)
      .leftJoin(roles, eq(roles.code, roleAssignments.roleCode))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(eq(roleAssignments.userId, userId));

    const byAssignment = new Map<
      string,
      {
        assignmentId: string;
        roleCode: string;
        authorityId: string | null;
        jurisdictionId: string | null;
        scope: string;
        permissions: Set<string>;
      }
    >();

    for (const row of assignments) {
      let entry = byAssignment.get(row.assignmentId);
      if (!entry) {
        entry = {
          assignmentId: row.assignmentId,
          roleCode: row.roleCode,
          authorityId: row.authorityId,
          jurisdictionId: row.jurisdictionId,
          scope: row.scope,
          permissions: new Set<string>(),
        };
        byAssignment.set(row.assignmentId, entry);
      }
      if (row.permissionCode) entry.permissions.add(row.permissionCode);
    }

    const allPermissions = new Set<string>();
    const contexts: AssignmentContext[] = [];

    for (const entry of byAssignment.values()) {
      entry.permissions.forEach((p) => allPermissions.add(p));
      const allowed = await this.resolveAllowedDistrictIds(
        entry.jurisdictionId,
        entry.scope,
        entry.permissions,
      );
      contexts.push({
        assignmentId: entry.assignmentId,
        roleCode: entry.roleCode,
        authorityId: entry.authorityId,
        jurisdictionId: entry.jurisdictionId,
        scope: entry.scope,
        permissions: entry.permissions,
        allowedDistrictIds: allowed,
      });
    }

    return { userId, assignments: contexts, allPermissions };
  }

  /**
   * If every permission on the assignment is global in nature, the reference
   * jurisdiction still controls. National scope (no jurisdiction) allows all.
   */
  private async resolveAllowedDistrictIds(
    jurisdictionId: string | null,
    scope: string,
    _permissions: Set<string>,
  ): Promise<Set<string> | null> {
    if (scope === "national" || !jurisdictionId) return null;

    const rows = await this.db
      .select({
        countryId: jurisdictions.countryId,
        stateId: jurisdictions.stateId,
        districtId: jurisdictions.districtId,
        scopeLevel: jurisdictions.scopeLevel,
      })
      .from(jurisdictions)
      .where(eq(jurisdictions.id, jurisdictionId))
      .limit(1);

    const j = rows[0];
    if (!j) return new Set<string>();

    if (j.districtId) return new Set([j.districtId]);

    if (j.stateId) {
      const dists = await this.db
        .select({ id: districts.id })
        .from(districts)
        .where(eq(districts.stateId, j.stateId));
      return new Set(dists.map((d) => d.id));
    }

    if (j.countryId) {
      const dists = await this.db
        .select({ id: districts.id })
        .from(districts)
        .innerJoin(states, eq(states.id, districts.stateId))
        .innerJoin(countries, eq(countries.id, states.countryId))
        .where(eq(countries.id, j.countryId));
      return new Set(dists.map((d) => d.id));
    }

    return new Set<string>();
  }
}
