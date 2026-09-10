import type { UUID, ISODateTime } from "./common.js";

export const INSPECTION_TYPES = ["surprise", "routine", "special", "follow_up"] as const;

export const INSPECTION_TRIGGERS = ["officer", "risk_engine", "automatic"] as const;

export const INSPECTION_STATUSES = [
  "assigned",
  "scheduled",
  "in_progress",
  "evidence_collection",
  "submitted",
  "under_review",
  "findings",
  "corrective_actions",
  "verification",
  "closed",
] as const;

export type InspectionType = (typeof INSPECTION_TYPES)[number];
export type InspectionTrigger = (typeof INSPECTION_TRIGGERS)[number];
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

/**
 * Allowed lifecycle transitions (domain rule). Key = from, value = allowed next states.
 * Charter: Assignment → Scheduled/Assigned → Inspector Starts → Evidence Collection →
 * Submission → Review → Findings → Corrective Actions → Verification → Closure.
 */
export const INSPECTION_TRANSITIONS: Record<InspectionStatus, readonly InspectionStatus[]> = {
  assigned: ["scheduled", "in_progress", "closed"],
  scheduled: ["in_progress", "closed"],
  in_progress: ["evidence_collection", "submitted"],
  evidence_collection: ["submitted"],
  submitted: ["under_review"],
  under_review: ["findings", "corrective_actions", "closed"],
  findings: ["corrective_actions", "closed"],
  corrective_actions: ["verification", "closed"],
  verification: ["closed"],
  closed: [],
};

export const STARTED_STATUSES: readonly InspectionStatus[] = [
  "in_progress",
  "evidence_collection",
  "submitted",
  "under_review",
  "findings",
  "corrective_actions",
  "verification",
];

export interface Inspection {
  id: UUID;
  projectId: UUID;
  projectCode: string;
  projectName: string;
  districtId: UUID | null;
  templateId: UUID | null;
  type: InspectionType;
  trigger: InspectionTrigger;
  status: InspectionStatus;
  disclosurePolicyId: UUID | null;
  disclosureRuleType: string | null;
  scheduledStart: ISODateTime | null;
  scheduledEnd: ISODateTime | null;
  startedAt: ISODateTime | null;
  submittedAt: ISODateTime | null;
  assignedUserIds: UUID[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface InspectionListQuery {
  page?: number;
  pageSize?: number;
  status?: InspectionStatus;
  type?: InspectionType;
  projectId?: UUID;
}
