import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { DuplicateRoleAssignmentError } from "@netram/data";
import { PERMISSIONS } from "@netram/types";
import type {
  AssignRoleInput,
  JurisdictionView,
  RoleAssignmentView,
  RoleView,
  UpdateRolePermissionsInput,
  UpdateUserInput,
  UserAdminView,
  UserListQuery,
  UserListResponse,
  UserStatus,
} from "@netram/types";
import { assertNoSelfLockout } from "./guards.js";

const USER_MANAGE = "user:manage" as const;
const ROLE_MANAGE = "role:manage" as const;

export class UserAdminService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repository: {
      listUsers(
        page: number,
        pageSize: number,
        search?: string,
      ): Promise<{ items: UserAdminView[]; total: number }>;
      findUserById(id: string): Promise<UserAdminView | null>;
      updateUser(cmd: {
        userId: string;
        displayName?: string;
        status?: UserStatus;
        actorUserId: string | null;
        requestId: string | null;
        ipAddress: string | null;
        auditAction: "user.updated";
        eventType: "user.status_changed";
        eventPayload: { userId: string; status?: UserStatus };
        changedFields?: Record<string, unknown>;
      }): Promise<UserAdminView | null>;
      roleExists(roleCode: string): Promise<boolean>;
      jurisdictionExists(jurisdictionId: string): Promise<boolean>;
      assignRole(cmd: {
        assignmentId: string;
        userId: string;
        roleCode: string;
        authorityId: string | null;
        jurisdictionId: string | null;
        scope: AssignRoleInput["scope"];
        actorUserId: string | null;
        requestId: string | null;
        ipAddress: string | null;
        auditAction: "role.assignment_changed";
        eventType: "user.role_assigned";
      }): Promise<RoleAssignmentView>;
      findAssignment(assignmentId: string): Promise<RoleAssignmentView | null>;
      removeRoleAssignment(cmd: {
        assignmentId: string;
        actorUserId: string | null;
        requestId: string | null;
        ipAddress: string | null;
        auditAction: "role.assignment_changed";
        eventType: "user.role_unassigned";
      }): Promise<RoleAssignmentView | null>;
      listRolesWithPermissions(): Promise<RoleView[]>;
      findRoleByCode(roleCode: string): Promise<{ id: string; code: string; name: string } | null>;
      countRolesGranting(permissionCode: string): Promise<number>;
      updateRolePermissions(cmd: {
        roleId: string;
        roleCode: string;
        permissions: string[];
        actorUserId: string | null;
        requestId: string | null;
        ipAddress: string | null;
        auditAction: "role.changed";
        eventType: "role.permissions_changed";
      }): Promise<RoleView | null>;
      listJurisdictions(): Promise<JurisdictionView[]>;
    },
  ) {}

  async listUsers(ctx: RequestUserContext, query: UserListQuery): Promise<UserListResponse> {
    this.authz.requirePermission(ctx, USER_MANAGE);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.repository.listUsers(page, pageSize, query.search);
    return { ...result, page, pageSize };
  }

  async getUser(ctx: RequestUserContext, id: string): Promise<UserAdminView> {
    this.authz.requirePermission(ctx, USER_MANAGE);
    const user = await this.repository.findUserById(id);
    if (!user) throw AppError.notFound("User not found.");
    return user;
  }

  async updateUser(
    ctx: RequestUserContext,
    id: string,
    input: UpdateUserInput,
  ): Promise<UserAdminView> {
    this.authz.requirePermission(ctx, USER_MANAGE);
    const existing = await this.repository.findUserById(id);
    if (!existing) throw AppError.notFound("User not found.");

    const status = input.status;
    const user = await this.repository.updateUser({
      userId: id,
      displayName: input.displayName,
      status,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "user.updated",
      eventType: "user.status_changed",
      eventPayload: { userId: id, status },
      changedFields: { displayName: input.displayName, status },
    });
    return user ?? existing;
  }

  async assignRole(
    ctx: RequestUserContext,
    userId: string,
    input: AssignRoleInput,
  ): Promise<RoleAssignmentView> {
    this.authz.requirePermission(ctx, ROLE_MANAGE);
    const user = await this.repository.findUserById(userId);
    if (!user) throw AppError.notFound("User not found.");
    if (!(await this.repository.roleExists(input.roleCode)))
      throw AppError.notFound(`Role '${input.roleCode}' not found.`);
    if (input.scope === "jurisdiction") {
      if (!input.jurisdictionId)
        throw AppError.badRequest("jurisdictionId is required for jurisdiction scope.");
      if (!(await this.repository.jurisdictionExists(input.jurisdictionId)))
        throw AppError.badRequest("jurisdictionId does not reference a known jurisdiction.");
    }

    try {
      return await this.repository.assignRole({
        assignmentId: randomUUID(),
        userId,
        roleCode: input.roleCode,
        authorityId: input.authorityId ?? null,
        jurisdictionId: input.jurisdictionId ?? null,
        scope: input.scope,
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        auditAction: "role.assignment_changed",
        eventType: "user.role_assigned",
      });
    } catch (err) {
      if (err instanceof DuplicateRoleAssignmentError) throw AppError.conflict(err.message);
      throw err;
    }
  }

  async removeRoleAssignment(ctx: RequestUserContext, assignmentId: string): Promise<void> {
    this.authz.requirePermission(ctx, ROLE_MANAGE);
    const removed = await this.repository.removeRoleAssignment({
      assignmentId,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "role.assignment_changed",
      eventType: "user.role_unassigned",
    });
    if (!removed) throw AppError.notFound("Role assignment not found.");
  }

  async listRoles(ctx: RequestUserContext): Promise<RoleView[]> {
    this.authz.requirePermission(ctx, ROLE_MANAGE);
    return this.repository.listRolesWithPermissions();
  }

  async listJurisdictions(ctx: RequestUserContext): Promise<JurisdictionView[]> {
    if (
      !this.authz.hasPermission(ctx, ROLE_MANAGE) &&
      !this.authz.hasPermission(ctx, USER_MANAGE)
    ) {
      this.authz.requirePermission(ctx, ROLE_MANAGE);
    }
    return this.repository.listJurisdictions();
  }

  async updateRolePermissions(
    ctx: RequestUserContext,
    roleCode: string,
    input: UpdateRolePermissionsInput,
  ): Promise<RoleView> {
    this.authz.requirePermission(ctx, ROLE_MANAGE);
    const role = await this.repository.findRoleByCode(roleCode);
    if (!role) throw AppError.notFound(`Role '${roleCode}' not found.`);

    const known = PERMISSIONS as readonly string[];
    const unknown = input.permissions.filter((p) => !known.includes(p));
    if (unknown.length > 0)
      throw AppError.badRequest(`Unknown permission code(s): ${unknown.join(", ")}`);

    const current = await this.repository.listRolesWithPermissions();
    const currentRole = current.find((r) => r.code === roleCode);
    await assertNoSelfLockout({
      roleCode,
      currentPermissions: currentRole?.permissions ?? [],
      requestedPermissions: input.permissions,
      countGranters: (p) => this.repository.countRolesGranting(p),
    });

    const updated = await this.repository.updateRolePermissions({
      roleId: role.id,
      roleCode,
      permissions: input.permissions,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "role.changed",
      eventType: "role.permissions_changed",
    });
    return updated ?? toRoleViewFallback(role, input.permissions);
  }
}

function toRoleViewFallback(
  role: { id: string; code: string; name: string },
  permissions: string[],
): RoleView {
  return { id: role.id, code: role.code, name: role.name, permissions };
}
