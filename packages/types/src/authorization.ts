import type { UUID } from "./common.js";

export const PERMISSIONS = [
  "project:read",
  "project:create",
  "project:transition",
  "project:approve",
  "audit:read",
  "inspection:read",
  "inspection:create",
  "inspection:assign",
  "inspection:transition",
  "inspection:review",
  "observation:create",
  "evidence:create",
  "complaint:read",
  "complaint:create",
  "complaint:resolve",
  "corrective_action:read",
  "corrective_action:submit",
  "corrective_action:approve",
  "ai:anomaly:read",
  "ai:anomaly:transition",
  "notification:read",
  "report:read",
  "report:generate",
  "report:finalize",
  "cctv:read",
  "cctv:stream",
  "user:manage",
  "role:manage",
  "organisation:create",
  "programme:create",
  "inspector:register",
  "official:register",
  "vc_session:read",
  "vc_session:create",
  "vc_session:manage",
  "attendance:monitor:read",
  "attendance:anomaly:read",
  "attendance:anomaly:review",
  "attendance:individual:read",
  "attendance:export",
  "attendance:correction:create",
  "attendance:correction:approve",
  "attendance:config:write",
  "attendance:ingest",
  "fund:read",
  "fund:allocate",
  "fund:release",
  "expense:read",
  "expense:submit",
  "expense:verify",
  "expense:void",
  "financial_document:upload",
  "financial_document:verify",
  "financial_risk:read",
  "financial_risk:configure",
  "inspection_flag:read",
  "inspection_flag:assign",
  "inspection_flag:review",
  "inspection_flag:resolve",
  "inspection_flag:dismiss",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export const SCOPE_LEVELS = ["national", "authority", "jurisdiction"] as const;

export type ScopeLevel = (typeof SCOPE_LEVELS)[number];

export interface JurisdictionRef {
  countryId?: UUID | null;
  stateId?: UUID | null;
  districtId?: UUID | null;
}

export interface PermissionEntry {
  code: PermissionCode;
  name: string;
  description: string;
}

export interface Role {
  id: UUID;
  code: string;
  name: string;
  permissions: PermissionCode[];
}

export interface RoleAssignment {
  id: UUID;
  userId: UUID;
  roleCode: string;
  authorityId?: UUID | null;
  jurisdiction: JurisdictionRef | null;
  scope: ScopeLevel;
}

export interface UserAuthorizationContext {
  userId: UUID;
  assignments: RoleAssignment[];
  permissions?: Set<PermissionCode>;
}

export interface AuthorizeRequest {
  permission: PermissionCode;
  resource?: {
    type: "project" | "inspection" | "organisation" | "complaint" | "vc_session";
    id: UUID;
    /** Jurisdiction of the resource. */
    jurisdiction: JurisdictionRef | null;
    /** Owning organisation, when applicable. */
    organisationId?: UUID | null;
  };
}
