import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import {
  users as usersTable,
  roleAssignments as roleAssignmentsTable,
  roles as rolesTable,
  rolePermissions as rolePermissionsTable,
  jurisdictions,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  AssignmentScope,
  AuditAction,
  DomainEventType,
  JurisdictionView,
  RoleAssignmentView,
  RoleView,
  UserAdminView,
  UserStatus,
} from "@netram/types";

export interface AdminWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
}

export interface UpdateUserWrite extends AdminWriteContext {
  userId: string;
  displayName?: string;
  status?: UserStatus;
  auditAction: AuditAction;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
  changedFields?: Record<string, unknown>;
}

export interface AssignRoleWrite extends AdminWriteContext {
  assignmentId: string;
  userId: string;
  roleCode: string;
  authorityId: string | null;
  jurisdictionId: string | null;
  scope: AssignmentScope;
  auditAction: AuditAction;
  eventType: DomainEventType;
}

export interface RemoveRoleAssignmentWrite extends AdminWriteContext {
  assignmentId: string;
  auditAction: AuditAction;
  eventType: DomainEventType;
}

export interface UpdateRolePermissionsWrite extends AdminWriteContext {
  roleId: string;
  roleCode: string;
  permissions: string[];
  auditAction: AuditAction;
  eventType: DomainEventType;
}

export function toRoleAssignmentView(row: {
  id: string;
  roleCode: string;
  authorityId: string | null;
  jurisdictionId: string | null;
  scope: string;
}): RoleAssignmentView {
  return {
    id: row.id,
    roleCode: row.roleCode,
    authorityId: row.authorityId,
    jurisdictionId: row.jurisdictionId,
    scope: row.scope as AssignmentScope,
  };
}

export function toUserAdmin(
  row: {
    id: string;
    email: string;
    displayName: string | null;
    status: string;
    createdAt: Date;
  },
  assignments: RoleAssignmentView[],
): UserAdminView {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status as UserStatus,
    assignments,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRoleView(
  row: { id: string; code: string; name: string },
  permissions: string[],
): RoleView {
  return { id: row.id, code: row.code, name: row.name, permissions };
}

export class DuplicateRoleAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateRoleAssignmentError";
  }
}

/**
 * Persistence for the user/role administration workspace. Writes are
 * transactional (mutation + audit + outbox event) so authorization context
 * changes are durable and observable (§37/§27).
 */
export class UserAdminRepository {
  constructor(private db: DrizzleDB) {}

  async listUsers(
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<{ items: UserAdminView[]; total: number }> {
    const searchCond = search
      ? or(ilike(usersTable.displayName, `%${search}%`), ilike(usersTable.email, `%${search}%`))
      : undefined;

    const rows = await this.db
      .select({ user: usersTable, assignment: roleAssignmentsTable })
      .from(usersTable)
      .leftJoin(roleAssignmentsTable, eq(roleAssignmentsTable.userId, usersTable.id))
      .where(searchCond)
      .orderBy(asc(usersTable.email))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [total] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(searchCond);

    const byUser = new Map<
      string,
      {
        row: {
          id: string;
          email: string;
          displayName: string | null;
          status: string;
          createdAt: Date;
        };
        assignments: RoleAssignmentView[];
      }
    >();
    for (const r of rows) {
      const key = r.user.id;
      let entry = byUser.get(key);
      if (!entry) {
        entry = { row: r.user, assignments: [] };
        byUser.set(key, entry);
      }
      if (r.assignment) entry.assignments.push(toRoleAssignmentView(r.assignment));
    }

    return {
      items: [...byUser.values()].map((e) => toUserAdmin(e.row, e.assignments)),
      total: total?.count ?? 0,
    };
  }

  async findUserById(id: string): Promise<UserAdminView | null> {
    const rows = await this.db
      .select({ user: usersTable, assignment: roleAssignmentsTable })
      .from(usersTable)
      .leftJoin(roleAssignmentsTable, eq(roleAssignmentsTable.userId, usersTable.id))
      .where(eq(usersTable.id, id))
      .orderBy(asc(roleAssignmentsTable.createdAt));

    if (!rows[0]) return null;
    const assignments = rows
      .filter((r) => r.assignment)
      .map((r) => toRoleAssignmentView(r.assignment!));
    return toUserAdmin(rows[0].user, assignments);
  }

  async updateUser(cmd: UpdateUserWrite): Promise<UserAdminView | null> {
    const changes: { displayName?: string; status?: string } = {};
    if (cmd.displayName !== undefined) changes.displayName = cmd.displayName;
    if (cmd.status !== undefined) changes.status = cmd.status;

    await this.db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(usersTable.id, cmd.userId));

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "user",
        resourceId: cmd.userId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: cmd.changedFields ?? null,
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.userId,
        actorUserId: cmd.actorUserId,
        resourceType: "user",
        resourceId: cmd.userId,
        payload: cmd.eventPayload,
      });
    });

    return this.findUserById(cmd.userId);
  }

  async roleExists(roleCode: string): Promise<boolean> {
    const rows = await this.db
      .select({ code: rolesTable.code })
      .from(rolesTable)
      .where(eq(rolesTable.code, roleCode))
      .limit(1);
    return rows.length > 0;
  }

  async jurisdictionExists(jurisdictionId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(eq(jurisdictions.id, jurisdictionId))
      .limit(1);
    return rows.length > 0;
  }

  async listJurisdictions(): Promise<JurisdictionView[]> {
    return this.db
      .select({
        id: jurisdictions.id,
        code: jurisdictions.code,
        name: jurisdictions.name,
        scopeLevel: jurisdictions.scopeLevel,
      })
      .from(jurisdictions)
      .orderBy(asc(jurisdictions.name));
  }

  async assignRole(cmd: AssignRoleWrite): Promise<RoleAssignmentView> {
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: roleAssignmentsTable.id })
        .from(roleAssignmentsTable)
        .where(
          and(
            eq(roleAssignmentsTable.userId, cmd.userId),
            eq(roleAssignmentsTable.roleCode, cmd.roleCode),
          ),
        )
        .limit(1);
      if (existing[0])
        throw new DuplicateRoleAssignmentError("User already has this role assignment.");

      await tx.insert(roleAssignmentsTable).values({
        id: cmd.assignmentId,
        userId: cmd.userId,
        roleCode: cmd.roleCode,
        authorityId: cmd.authorityId ?? null,
        jurisdictionId: cmd.jurisdictionId ?? null,
        scope: cmd.scope,
      });

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "user",
        resourceId: cmd.userId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: {
          roleCode: cmd.roleCode,
          scope: cmd.scope,
          jurisdictionId: cmd.jurisdictionId,
          authorityId: cmd.authorityId,
        },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.userId,
        actorUserId: cmd.actorUserId,
        resourceType: "user",
        resourceId: cmd.userId,
        payload: {
          userId: cmd.userId,
          roleCode: cmd.roleCode,
          scope: cmd.scope,
        },
      });
    });

    return toRoleAssignmentView({
      id: cmd.assignmentId,
      roleCode: cmd.roleCode,
      authorityId: cmd.authorityId ?? null,
      jurisdictionId: cmd.jurisdictionId ?? null,
      scope: cmd.scope,
    });
  }

  async findAssignment(assignmentId: string): Promise<RoleAssignmentView | null> {
    const rows = await this.db
      .select()
      .from(roleAssignmentsTable)
      .where(eq(roleAssignmentsTable.id, assignmentId))
      .limit(1);
    if (!rows[0]) return null;
    return toRoleAssignmentView(rows[0]);
  }

  async removeRoleAssignment(cmd: RemoveRoleAssignmentWrite): Promise<RoleAssignmentView | null> {
    const existing = await this.findAssignment(cmd.assignmentId);
    if (!existing) return null;

    await this.db.transaction(async (tx) => {
      await tx.delete(roleAssignmentsTable).where(eq(roleAssignmentsTable.id, cmd.assignmentId));

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "user",
        resourceId: existing.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { roleCode: existing.roleCode, scope: existing.scope },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: existing.id,
        actorUserId: cmd.actorUserId,
        resourceType: "user",
        resourceId: existing.id,
        payload: { roleCode: existing.roleCode, scope: existing.scope },
      });
    });

    return existing;
  }

  async listRolesWithPermissions(): Promise<RoleView[]> {
    const rows = await this.db
      .select({
        role: rolesTable,
        permissionCode: rolePermissionsTable.permissionCode,
      })
      .from(rolesTable)
      .leftJoin(rolePermissionsTable, eq(rolePermissionsTable.roleId, rolesTable.id))
      .orderBy(asc(rolesTable.code));

    const byRole = new Map<
      string,
      {
        role: { id: string; code: string; name: string };
        permissions: string[];
      }
    >();
    for (const r of rows) {
      let entry = byRole.get(r.role.id);
      if (!entry) {
        entry = { role: r.role, permissions: [] };
        byRole.set(r.role.id, entry);
      }
      if (r.permissionCode) entry.permissions.push(r.permissionCode);
    }

    return [...byRole.values()].map((e) => toRoleView(e.role, e.permissions));
  }

  async findRoleByCode(
    roleCode: string,
  ): Promise<{ id: string; code: string; name: string } | null> {
    const rows = await this.db
      .select({
        id: rolesTable.id,
        code: rolesTable.code,
        name: rolesTable.name,
      })
      .from(rolesTable)
      .where(eq(rolesTable.code, roleCode))
      .limit(1);
    return rows[0] ?? null;
  }

  async countRolesGranting(permissionCode: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(rolePermissionsTable)
      .where(eq(rolePermissionsTable.permissionCode, permissionCode));
    return rows[0]?.count ?? 0;
  }

  async updateRolePermissions(cmd: UpdateRolePermissionsWrite): Promise<RoleView | null> {
    const role = await this.findRoleByCode(cmd.roleCode);
    if (!role) return null;

    await this.db.transaction(async (tx) => {
      await tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, role.id));
      if (cmd.permissions.length > 0) {
        await tx.insert(rolePermissionsTable).values(
          cmd.permissions.map((p) => ({
            roleId: role.id,
            permissionCode: p,
          })),
        );
      }

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "role",
        resourceId: role.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { roleCode: cmd.roleCode, permissions: cmd.permissions },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: role.code,
        actorUserId: cmd.actorUserId,
        resourceType: "role",
        resourceId: role.id,
        payload: { roleCode: role.code, permissions: cmd.permissions },
      });
    });

    return toRoleView(role, cmd.permissions);
  }
}
