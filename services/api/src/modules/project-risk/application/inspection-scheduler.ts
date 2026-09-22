import type { CompositeRiskScore, SchedulingDecision } from "@netram/types";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRiskRepository, InspectionFlagRepository } from "@netram/data";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import {
  DEFAULT_SCHEDULING_POLICY,
  type SchedulingPolicy,
} from "../config/risk-config.js";

export class InspectionScheduler {
  constructor(
    private readonly projectRiskRepo: ProjectRiskRepository,
    private readonly flagRepo: InspectionFlagRepository,
    private readonly inspectionService: Pick<InspectionService, "createInspection">,
    private readonly policy: SchedulingPolicy = DEFAULT_SCHEDULING_POLICY,
  ) {}

  async evaluateAndSchedule(
    ctx: RequestUserContext,
    projectId: string,
    score: CompositeRiskScore,
  ): Promise<SchedulingDecision> {
    // 1. Threshold check
    if (score.totalScore < this.policy.autoScheduleThreshold) {
      return {
        projectId,
        shouldSchedule: false,
        reason: `Composite risk score ${score.totalScore} is below auto-schedule threshold of ${this.policy.autoScheduleThreshold}`,
        actionTaken: "threshold_not_met",
      };
    }

    // 2. Open inspection check
    const hasOpenInspection = await this.projectRiskRepo.hasOpenInspection(projectId);
    if (hasOpenInspection) {
      return {
        projectId,
        shouldSchedule: false,
        reason: "Project already has an active inspection in progress",
        actionTaken: "existing_open_inspection_skipped",
      };
    }

    // 3. Cooldown and Critical override check
    const isCritical = score.totalScore >= this.policy.criticalOverrideThreshold;
    const dates = await this.projectRiskRepo.getLastInspectionDates(projectId);
    const now = new Date();

    if (!isCritical) {
      const lastActionDate = dates.lastScheduledAt ?? dates.lastCompletedAt;
      if (lastActionDate) {
        const daysSince =
          (now.getTime() - new Date(lastActionDate).getTime()) / (24 * 60 * 60 * 1000);
        if (daysSince < this.policy.cooldownDays) {
          return {
            projectId,
            shouldSchedule: false,
            reason: `Inspection cooldown active (${Math.ceil(this.policy.cooldownDays - daysSince)} days remaining)`,
            actionTaken: "cooldown_skipped",
          };
        }
      }
    } else {
      // Critical override applies, but enforce same-day guard (e.g. 12 hours)
      if (dates.lastScheduledAt) {
        const hoursSince =
          (now.getTime() - new Date(dates.lastScheduledAt).getTime()) / (60 * 60 * 1000);
        if (hoursSince < 12) {
          return {
            projectId,
            shouldSchedule: false,
            reason: "Critical override active, but an inspection was already scheduled within the past 12 hours",
            actionTaken: "cooldown_skipped",
          };
        }
      }
    }

    // 4. Ensure inspection flag exists or create one
    let inspectionFlag = await this.flagRepo.findOpenFlagByProject(projectId);
    if (!inspectionFlag) {
      const topExpl = score.topContributors.map((c) => `${c.dimension}: ${c.contribution}pts`).join(", ");
      inspectionFlag = await this.flagRepo.createWithAudit({
        projectId,
        riskScore: score.totalScore,
        riskLevel: score.riskLevel,
        triggerSource: "risk_engine",
        explanation: `Automated inspection flag created by project-risk engine: Composite Score ${score.totalScore}/100 (${score.riskLevel}). Contributors: ${topExpl}`,
        evidenceRefs: score.topContributors.map((tc) => ({
          type: "risk_dimension",
          id: tc.dimension,
          label: tc.explanation,
        })),
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        auditAction: "financial_risk.flag_created",
        auditMetadata: { score: score.totalScore, riskLevel: score.riskLevel },
        eventType: "inspection_flag.created",
        eventPayload: { projectId, score: score.totalScore, riskLevel: score.riskLevel },
      });
    }

    // 5. Schedule inspection via existing InspectionService
    const scheduledStart = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // Default to tomorrow
    const scheduledEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const createdInspection = await this.inspectionService.createInspection(ctx, {
      projectId,
      type: "special",
      trigger: "risk_engine",
      scheduledStart,
      scheduledEnd,
    });

    // Link flag to the newly created inspection
    if (inspectionFlag) {
      await this.flagRepo.linkInspectionWithAudit(inspectionFlag.id, createdInspection.id, ctx.userId).catch(() => null);
    }

    return {
      projectId,
      shouldSchedule: true,
      reason: isCritical
        ? `Critical risk score (${score.totalScore}) exceeded threshold (${this.policy.criticalOverrideThreshold}) - cooldown bypassed`
        : `High risk score (${score.totalScore}) exceeded threshold (${this.policy.autoScheduleThreshold})`,
      actionTaken: "scheduled",
      inspectionId: createdInspection.id,
      inspectionFlagId: inspectionFlag?.id,
    };
  }
}
