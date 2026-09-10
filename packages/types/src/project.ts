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

export const PROJECT_TYPES = ["institution", "authority_project", "other"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export interface Project {
  id: UUID;
  code: string;
  name: string;
  type: ProjectType;
  description: string | null;
  organisationId: UUID | null;
  authorityId: UUID | null;
  districtId: UUID | null;
  status: ProjectStatus;
  approvedById: UUID | null;
  approvedAt: ISODateTime | null;
  programmeIds: UUID[];
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
