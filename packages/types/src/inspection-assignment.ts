import type { UUID, ISODateTime } from "./common.js";

export const ASSIGNMENT_ROLES = ["lead", "member"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export interface InspectionAssignment {
  id: UUID;
  inspectionId: UUID;
  userId: UUID;
  userName: string | null;
  role: AssignmentRole;
  assignedAt: ISODateTime;
  /** Inspection/project context joined at read time. */
  inspectionStatus: string | null;
  inspectionType: string | null;
  projectCode: string | null;
  projectName: string | null;
  districtId: UUID | null;
}

export interface AssignmentListQuery {
  page?: number;
  pageSize?: number;
}
