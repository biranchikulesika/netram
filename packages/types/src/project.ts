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
export const PROJECT_TYPES = [
  "institution",
  "village",
  "authority_project",
  "other",
] as const;

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
  districtId: UUID | null;
  /** Village-level location for village-type targets (PM-AJAY Adarsh Gram). */
  villageId: UUID | null;
  /** Scheme component this target is an instance of (docs/DoSJE.md §21). */
  schemeComponentId: UUID | null;
  status: ProjectStatus;
  approvedById: UUID | null;
  approvedAt: ISODateTime | null;
  programmeIds: UUID[];
  geofence?: ProjectGeofence | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
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

export interface ProjectTransitionResult {
  project: Project;
  event: string;
}

