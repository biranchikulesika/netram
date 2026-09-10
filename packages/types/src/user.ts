import type { UUID, ISODateTime } from "./common.js";

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ASSIGNMENT_SCOPES = ["national", "jurisdiction"] as const;
export type AssignmentScope = (typeof ASSIGNMENT_SCOPES)[number];

export interface RoleAssignmentView {
  id: UUID;
  roleCode: string;
  authorityId: UUID | null;
  jurisdictionId: UUID | null;
  scope: AssignmentScope;
}

export interface UserAdminView {
  id: UUID;
  email: string;
  displayName: string | null;
  status: UserStatus;
  assignments: RoleAssignmentView[];
  createdAt: ISODateTime;
}

export interface RoleView {
  id: UUID;
  code: string;
  name: string;
  permissions: string[];
}

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface UserListResponse {
  items: UserAdminView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateUserInput {
  displayName?: string;
  status?: UserStatus;
}

export interface AssignRoleInput {
  roleCode: string;
  authorityId?: UUID;
  jurisdictionId?: UUID;
  scope: AssignmentScope;
}

export interface UpdateRolePermissionsInput {
  permissions: string[];
}
