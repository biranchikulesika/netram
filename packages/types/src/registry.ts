import type { UUID, ISODateTime } from "./common.js";
import type { PermissionCode } from "./authorization.js";

/**
 * Registration capability matrix — the single source of truth for
 * "who can register what" in the Registry (see apps/web/app/registry).
 *
 * The API enforces `permission` server-side on every registry route;
 * the web UI uses the same matrix to decide which cards to render.
 */
export interface RegistryCapability {
  /** Stable identifier used in UI + API error details. */
  key:
    | "facility"
    | "organisation"
    | "programme"
    | "inspector"
    | "official";
  /** Display label for the registry card. */
  label: string;
  /** One-line explanation shown on the registry card. */
  description: string;
  /** Permission that gates this registration (enforced server-side). */
  permission: PermissionCode;
  /** Who is allowed to perform this registration (informational; permission is authoritative). */
  who: string;
  /** Whether the created record starts in a pending/Inactive state. */
  startsPending: boolean;
}

export const REGISTRY_PERMISSIONS = [
  "organisation:create",
  "programme:create",
  "inspector:register",
  "official:register",
] as const;

export const REGISTRY_CAPABILITIES: readonly RegistryCapability[] = [
  {
    key: "facility",
    label: "Facility / Project",
    description:
      "Register a welfare facility: sanction, location, agency, capacity and photo evidence.",
    permission: "project:create",
    who: "Institution admins and authority officials",
    startsPending: true,
  },
  {
    key: "organisation",
    label: "Agency / Society",
    description:
      "Register an operating agency or society that runs facilities on the ground.",
    permission: "organisation:create",
    who: "Authority officials",
    startsPending: false,
  },
  {
    key: "programme",
    label: "Scheme / Programme",
    description:
      "Register a welfare scheme or programme that facilities participate in.",
    permission: "programme:create",
    who: "Authority officials",
    startsPending: false,
  },
  {
    key: "inspector",
    label: "Inspector",
    description:
      "Invite a field inspector, assign their jurisdiction and put them on inspection teams.",
    permission: "inspector:register",
    who: "Authority officials",
    startsPending: true,
  },
  {
    key: "official",
    label: "Authority Official / Admin",
    description:
      "Invite an official and grant them a role, authority and jurisdiction. Highest-privilege registration.",
    permission: "official:register",
    who: "System administrators only",
    startsPending: true,
  },
];

/* ---------- Programme geographic scope ---------- */

/**
 * Geographic reach of a scheme/programme. Governs which facilities may
 * participate: a state-scoped scheme is only linkable from facilities inside
 * that state; a district-scoped scheme only from facilities in that district.
 * National programmes are linkable from anywhere.
 */
export const PROGRAMME_SCOPE_LEVELS = ["national", "state", "district"] as const;
export type ProgrammeScopeLevel = (typeof PROGRAMME_SCOPE_LEVELS)[number];

/** Human-readable suffix rendered next to a programme's name/code. */
export const PROGRAMME_SCOPE_LABELS: Record<ProgrammeScopeLevel, string> = {
  national: "National",
  state: "State",
  district: "District",
};

/* ---------- Registry API views & inputs ---------- */

/** State referenced by scheme scope pickers. */
export interface StateView {
  id: UUID;
  code: string;
  name: string;
}

/** District referenced by scheme scope and agency registration. */
export interface DistrictView {
  id: UUID;
  code: string;
  name: string;
  stateId: UUID;
  stateName: string;
}

export interface OrganisationView {
  id: UUID;
  code: string;
  name: string;
  category: string;
  authorityId: UUID | null;
  createdAt: ISODateTime;
}

export interface ProgrammeView {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  scopeLevel: ProgrammeScopeLevel;
  /** Required when scopeLevel is "state": the UUID of the states row. */
  stateId: UUID | null;
  /** Required when scopeLevel is "district": the UUID of the districts row. */
  districtId: UUID | null;
  authorityId: UUID | null;
  createdAt: ISODateTime;
}

export interface RegistryUserView {
  userId: UUID;
  assignmentId: UUID;
  email: string;
  displayName: string | null;
  roleCode: string;
  status: string;
}

export interface CreateOrganisationInput {
  code: string;
  name: string;
  category: string;
}

export interface CreateProgrammeInput {
  code: string;
  name: string;
  description?: string | null;
  scopeLevel: ProgrammeScopeLevel;
  stateId?: UUID | null;
  districtId?: UUID | null;
}

export interface RegisterInspectorInput {
  email: string;
  displayName: string;
  phone?: string | null;
  jurisdictionId: UUID;
}

export interface RegisterOfficialInput {
  email: string;
  displayName: string;
  phone?: string | null;
  roleCode: string;
  authorityId?: UUID | null;
  jurisdictionId?: UUID | null;
  scope: "national" | "jurisdiction";
}
