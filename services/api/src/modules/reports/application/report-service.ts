import { randomUUID } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { Report, ReportListQuery, ReportListResponse, ReportStatus } from "@netram/types";
import type { ReportRepositoryPort, ReportJobEnqueuerPort } from "./ports/report-repository.js";
import { evaluateReportTransition } from "../domain/report.js";
import { buildReportArtifact } from "./report-builder.js";

const READ = "report:read" as const;
const GENERATE = "report:generate" as const;
const FINALIZE = "report:finalize" as const;

export class ReportService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly inspectionService: Pick<InspectionService, "getInspection">,
    private readonly repository: ReportRepositoryPort,
    private readonly jobs: ReportJobEnqueuerPort,
  ) {}

  async listReports(ctx: RequestUserContext, query: ReportListQuery): Promise<ReportListResponse> {
    this.authz.requirePermission(ctx, READ);

    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = this.authz.accessibleDistrictIds(ctx);
    const page = await this.repository.list({
      page: pageNum,
      pageSize,
      inspectionId: query.inspectionId,
      status: query.status,
      jurisdictionIds: scope ? [...scope] : undefined,
    });
    return { items: page.items, total: page.total, page: pageNum, pageSize };
  }

  async getReport(ctx: RequestUserContext, id: string): Promise<Report> {
    this.authz.requirePermission(ctx, READ);
    const report = await this.repository.findById(id);
    if (!report || !report.districtId || !this.authz.canAccessDistrict(ctx, report.districtId))
      throw AppError.notFound("Report not found.");
    return report;
  }

  async createReport(
    ctx: RequestUserContext,
    cmd: { inspectionId: string; format?: "json" },
  ): Promise<Report> {
    const inspection = await this.inspectionService.getInspection(ctx, cmd.inspectionId);
    this.authz.requirePermission(ctx, GENERATE, {
      districtId: inspection.districtId,
    });

    const report = await this.repository.create({
      id: randomUUID(),
      inspectionId: cmd.inspectionId,
      format: cmd.format ?? "json",
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
    });

    await this.jobs.enqueue(report.id).catch((err: Error) => {
      throw AppError.internal(`Failed to enqueue report generation: ${err.message}`);
    });
    return report;
  }

  async finalizeReport(ctx: RequestUserContext, id: string): Promise<Report> {
    const report = await this.repository.findById(id);
    if (!report || !report.districtId) throw AppError.notFound("Report not found.");
    this.authz.requirePermission(ctx, FINALIZE, {
      districtId: report.districtId,
    });

    evaluateReportTransition(report.status as ReportStatus, "finalized");
    return this.repository.finalize({
      reportId: id,
      finalizedBy: ctx.userId,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
    });
  }

  /** Used by the report worker to derive the artifact from authoritative records. */
  async buildArtifactForInspection(inspectionId: string): Promise<Record<string, unknown>> {
    const snapshot = await this.repository.loadSnapshot(inspectionId);
    return buildReportArtifact(snapshot);
  }
}
