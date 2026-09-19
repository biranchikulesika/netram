import type { UUID, ISODateTime } from "./common.js";

export const REPORT_FORMATS = ["json"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_STATUSES = ["requested", "generating", "ready", "failed", "finalized"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * Report lifecycle (§34). Finalized reports are immutable.
 * requested -> generating -> ready -> finalized
 *   generating -> failed (retryable) -> generating
 */
export const REPORT_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  requested: ["generating"],
  generating: ["ready", "failed"],
  failed: ["generating"],
  ready: ["finalized"],
  finalized: [],
};

/**
 * Derived inspection report (§34/§1310). Underlying domain records remain the
 * source of truth; the artifact is a deterministic derivation for reporting.
 */
export interface Report {
  id: UUID;
  inspectionId: UUID;
  format: ReportFormat;
  status: ReportStatus;
  inspectionType: string;
  inspectionStatus: string;
  projectCode: string | null;
  projectName: string | null;
  districtId: UUID | null;
  requestedBy: UUID | null;
  requestedAt: ISODateTime;
  generatedBy: UUID | null;
  generatedAt: ISODateTime | null;
  error: string | null;
  finalizedBy: UUID | null;
  finalizedAt: ISODateTime | null;
  artifact?: Record<string, unknown> | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ReportListQuery {
  page?: number;
  pageSize?: number;
  inspectionId?: UUID;
  status?: ReportStatus;
}

export interface ReportListResponse {
  items: Report[];
  total: number;
  page: number;
  pageSize: number;
}
