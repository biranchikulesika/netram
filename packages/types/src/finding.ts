import type { UUID, ISODateTime } from "./common.js";

export const FINDING_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const FINDING_STATUSES = ["new", "confirmed", "dismissed", "action_required"] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/**
 * Authority review of a finding (AGENTS.md §32). A finding starts as `new`
 * from inspector observation. An authority officer either confirms it or
 * dismisses it. Issuing a corrective action moves a confirmed finding to
 * `action_required`. Dismissed is terminal.
 */
export const FINDING_TRANSITIONS: Record<FindingStatus, readonly FindingStatus[]> = {
  new: ["confirmed", "dismissed"],
  confirmed: ["action_required"],
  dismissed: [],
  action_required: [],
};

export interface Finding {
  id: UUID;
  inspectionId: UUID;
  observationId: UUID | null;
  severity: FindingSeverity;
  description: string;
  remediation: string | null;
  status: FindingStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
