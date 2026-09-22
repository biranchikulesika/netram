import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { ProjectRiskRepository, AuditRepository } from "@netram/data";
import type {
  ProjectRiskSnapshot,
  ProjectRankEntry,
  ProjectRiskRankingQuery,
  ProjectRiskSnapshotQuery,
} from "@netram/types";
import type { ProjectRiskContextBuilder } from "./project-risk-context-builder.js";
import type { CompositeRiskScorer } from "../domain/composite-risk-scorer.js";
import type { InspectionScheduler } from "./inspection-scheduler.js";

const RISK_READ = "project_risk:read" as const;
const RISK_EVALUATE = "project_risk:evaluate" as const;

export class ProjectRiskService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly contextBuilder: ProjectRiskContextBuilder,
    private readonly scorer: CompositeRiskScorer,
    private readonly scheduler: InspectionScheduler,
    private readonly projectRiskRepo: ProjectRiskRepository,
    private readonly auditRepo: AuditRepository,
  ) {}

  async evaluateProject(
    ctx: RequestUserContext,
    projectId: string,
  ): Promise<ProjectRiskSnapshot> {
    this.authz.requirePermission(ctx, RISK_EVALUATE);

    // 1. Build evaluation context
    const evalContext = await this.contextBuilder.buildContext(ctx, projectId);

    // Check district permission if project is assigned to a district
    if (evalContext.project.districtId) {
      this.authz.requirePermission(ctx, RISK_EVALUATE, {
        districtId: evalContext.project.districtId,
      });
    }

    // 2. Calculate Composite Risk Score
    const compositeScore = this.scorer.calculateScore(evalContext);

    // 3. Evaluate scheduling & trigger inspection if warranted
    let scheduledInspectionId: string | null = null;
    let inspectionFlagId: string | null = null;

    try {
      const decision = await this.scheduler.evaluateAndSchedule(ctx, projectId, compositeScore);
      if (decision.shouldSchedule && decision.inspectionId) {
        scheduledInspectionId = decision.inspectionId;
      }
      if (decision.inspectionFlagId) {
        inspectionFlagId = decision.inspectionFlagId;
      }
    } catch {
      // Don't fail risk scoring if automatic inspection scheduling encounters an issue
    }

    // 4. Explanation assembly
    const topContrExpl = compositeScore.topContributors
      .map((c) => `${c.dimension}: ${c.contribution}pts (${c.percentage}%)`)
      .join("; ");
    const compoundSuffix = compositeScore.compoundBonus
      ? ` [Multi-Vector Synergy +${compositeScore.compoundBonus}pts]`
      : "";
    const directivesSuffix =
      compositeScore.actionableDirectives && compositeScore.actionableDirectives.length > 0
        ? ` Directives: ${compositeScore.actionableDirectives.slice(0, 2).join(" | ")}`
        : "";
    const explanation = `Composite Risk Score: ${compositeScore.totalScore}/100 (${compositeScore.riskLevel})${compoundSuffix}. Contributors: ${topContrExpl || "None"}.${directivesSuffix}`;

    // 5. Persist Snapshot
    const snapshot = await this.projectRiskRepo.insertSnapshot({
      projectId,
      calculatedAt: new Date(compositeScore.calculatedAt),
      scoringVersion: compositeScore.scoringVersion,
      totalScore: compositeScore.totalScore,
      riskLevel: compositeScore.riskLevel,
      financialScore: Math.round(compositeScore.dimensions.financial.weightedContribution),
      inspectionQualityScore: Math.round(
        compositeScore.dimensions.inspection_quality.weightedContribution,
      ),
      attendanceAnomalyScore: Math.round(
        compositeScore.dimensions.attendance_anomaly.weightedContribution,
      ),
      complaintDensityScore: Math.round(
        compositeScore.dimensions.complaint_density.weightedContribution,
      ),
      aiAnomalyScore: Math.round(compositeScore.dimensions.ai_anomaly.weightedContribution),
      financialSignals: compositeScore.dimensions.financial.signals,
      inspectionQualitySignals: compositeScore.dimensions.inspection_quality.signals,
      attendanceAnomalySignals: compositeScore.dimensions.attendance_anomaly.signals,
      complaintDensitySignals: compositeScore.dimensions.complaint_density.signals,
      aiAnomalySignals: compositeScore.dimensions.ai_anomaly.signals,
      topContributors: compositeScore.topContributors,
      explanation,
      inspectionFlagId,
      scheduledInspectionId,
    });

    // 6. Record Audit Event
    await this.auditRepo.append({
      action: "project.updated",
      actorUserId: ctx.userId,
      resourceType: "project",
      resourceId: projectId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata: {
        scoringVersion: compositeScore.scoringVersion,
        totalScore: compositeScore.totalScore,
        riskLevel: compositeScore.riskLevel,
        scheduledInspectionId,
        inspectionFlagId,
      },
    }).catch(() => null);

    return snapshot;
  }

  async sweepAllActiveProjects(
    ctx: RequestUserContext,
  ): Promise<{ evaluatedCount: number; scheduledCount: number }> {
    this.authz.requirePermission(ctx, RISK_EVALUATE);

    const activeProjects = await this.projectRiskRepo.findAllActiveProjects();
    let evaluatedCount = 0;
    let scheduledCount = 0;

    for (const project of activeProjects) {
      try {
        const snapshot = await this.evaluateProject(ctx, project.id);
        evaluatedCount++;
        if (snapshot.scheduledInspectionId) {
          scheduledCount++;
        }
      } catch {
        // Continue processing other projects
      }
    }

    return { evaluatedCount, scheduledCount };
  }

  async listRankings(
    ctx: RequestUserContext,
    query: ProjectRiskRankingQuery,
  ): Promise<{ items: ProjectRankEntry[]; total: number }> {
    this.authz.requirePermission(ctx, RISK_READ);

    const scope = this.authz.accessibleDistrictIds(ctx);
    if (scope && scope.size > 0 && query.districtId && !scope.has(query.districtId)) {
      return { items: [], total: 0 };
    }

    return this.projectRiskRepo.listRanked(query);
  }

  async getRecentSnapshots(
    ctx: RequestUserContext,
    query: ProjectRiskSnapshotQuery,
  ): Promise<ProjectRiskSnapshot[]> {
    this.authz.requirePermission(ctx, RISK_READ);
    return this.projectRiskRepo.findRecentSnapshots(query);
  }

  async getLatestSnapshot(
    ctx: RequestUserContext,
    projectId: string,
  ): Promise<ProjectRiskSnapshot | null> {
    this.authz.requirePermission(ctx, RISK_READ);
    return this.projectRiskRepo.findLatestByProject(projectId);
  }
}
