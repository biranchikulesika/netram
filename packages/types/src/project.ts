import type { UUID, ISODateTime } from "./common.js";

export const PROJECT_STATUSES = [
  "Draft",
  "Pending Verification",
  "Approved",
  "Active",
  "Suspended",
  "Closed",
  "Archived",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Allowed lifecycle transitions (domain rule). Key = from, value = allowed next states.
 */
export const PROJECT_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  Draft: ["Pending Verification", "Archived"],
  "Pending Verification": ["Approved", "Draft", "Archived"],
  Approved: ["Active", "Closed"],
  Active: ["Suspended", "Closed"],
  Suspended: ["Active", "Closed"],
  Closed: ["Archived"],
  Archived: [],
};

/**
 * Monitored implementation target kinds (DoSJE domain, docs/DoSJE.md §23).
 * The official social audit calendar audits both institution-type targets
 * (senior citizen homes, IRCAs, hostels, schools) and village-type targets
 * (PM-AJAY Adarsh Gram, where no implementing institute exists).
 */
export const PROJECT_TYPES = ["institution", "village", "authority_project", "other"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export type GeofenceType = "circle" | "polygon";

export interface ProjectGeofence {
  id: UUID;
  projectId: UUID;
  type: GeofenceType;
  radiusMeters: number;
  centerLat: number | null;
  centerLng: number | null;
  polygonVertices: [number, number][]; // [lat, lng] pairs
  sealedById: UUID | null;
  sealedAt: ISODateTime;
  auditTx: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SealGeofenceCommand {
  type: GeofenceType;
  radiusMeters?: number;
  centerLat?: number;
  centerLng?: number;
  polygonVertices?: [number, number][];
}

export interface Project {
  id: UUID;
  code: string;
  name: string;
  type: ProjectType;
  description: string | null;
  organisationId: UUID | null;
  authorityId: UUID | null;
  /**
   * Resolved display names for the two foreign keys above, joined in the data
   * layer on read paths. Absent (undefined) when the project was loaded from a
   * write path, which does not join. Presentation must prefer these over any
   * locally fabricated label.
   */
  organisationName?: string | null;
  authorityName?: string | null;
  /** District and state names, joined in the data layer alongside the two above. */
  districtName?: string | null;
  stateName?: string | null;
  /** Programme names resolved from `programmeIds`; empty when none are linked. */
  programmeNames?: string[];
  districtId: UUID | null;
  /** Village-level location for village-type targets (PM-AJAY Adarsh Gram). */
  villageId: UUID | null;
  /** Scheme component this target is an instance of (docs/DoSJE.md §21). */
  schemeComponentId: UUID | null;
  status: ProjectStatus;
  approvedById: UUID | null;
  approvedAt: ISODateTime | null;
  /** Person in charge at the facility (structured contact, §34: disclosable). */
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  programmeIds: UUID[];
  geofence?: ProjectGeofence | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Minimal public-facing facility reference shown to citizens (grievance portal). */
export interface ProjectRegistryItem {
  id: string;
  code: string;
  name: string;
}

export interface ProjectListQuery {
  page?: number;
  pageSize?: number;
  status?: ProjectStatus;
  organisationId?: UUID;
  jurisdictionId?: UUID;
}

export interface TransitionProjectCommand {
  projectId: UUID;
  to: ProjectStatus;
  note?: string;
}

/** Payload for updating a facility's contact details. */
export interface UpdateProjectContactCommand {
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface ProjectTransitionResult {
  project: Project;
  event: string;
}
