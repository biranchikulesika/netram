import type { Report, ReportFormat, ReportStatus, UUID } from "@netram/types";
import type { ReportSnapshot } from "@netram/data";

export interface ReportJobEnqueuerPort {
  enqueue(reportId: UUID): Promise<void>;
}

export interface ReportCreateContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
}

export interface ReportListFilter {
  page: number;
  pageSize: number;
  inspectionId?: UUID;
  status?: ReportStatus;
  jurisdictionIds?: UUID[];
}

export interface GenerateReportWrite {
  reportId: UUID;
  generatedBy: UUID | null;
  artifact: Record<string, unknown>;
}

export interface FinalizeReportWrite {
  reportId: UUID;
  finalizedBy: UUID;
}

export interface ReportRepositoryPort {
  list(filter: ReportListFilter): Promise<{ items: Report[]; total: number }>;
  findById(id: UUID): Promise<Report | null>;
  create(
    cmd: {
      id: UUID;
      inspectionId: UUID;
      format: ReportFormat;
    } & ReportCreateContext,
  ): Promise<Report>;
  markGenerating(id: UUID): Promise<void>;
  generateWithArtifact(cmd: GenerateReportWrite): Promise<Report>;
  markFailed(cmd: { reportId: UUID; errorMessage: string } & ReportCreateContext): Promise<void>;
  finalize(cmd: FinalizeReportWrite & ReportCreateContext): Promise<Report>;
  loadSnapshot(inspectionId: UUID): Promise<ReportSnapshot>;
}
