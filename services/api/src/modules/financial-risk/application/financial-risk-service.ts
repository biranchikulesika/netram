import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { InspectionRepositoryPort } from "../../inspections/application/ports/inspection-repository.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type {
  FundRepository,
  ExpenseRepository,
  FinancialDocumentRepository,
  FinancialRiskRepository,
  InspectionFlagRepository,
} from "@netram/data";
import type {
  FinancialRiskRule,
  FinancialRiskEvent,
  InspectionFlag,
  InspectionFlagListQuery,
  InspectionFlagStatus,
  Inspection,
} from "@netram/types";
import type {
  CreateRiskRuleInput,
  PatchRiskRuleInput,
} from "@netram/validation";
import { createDefaultRuleEvaluators } from "../domain/rules/index.js";
import { scoreRiskResults, type ScoredRiskOutput } from "../domain/risk-scorer.js";
import type { RiskEvaluationContext, RuleEvaluationResult } from "../domain/rule-evaluator.js";

const RISK_READ = "financial_risk:read" as const;
const RISK_CONFIGURE = "financial_risk:configure" as const;
const FLAG_READ = "inspection_flag:read" as const;
const FLAG_ASSIGN = "inspection_flag:assign" as const;
const FLAG_REVIEW = "inspection_flag:review" as const;
const FLAG_RESOLVE = "inspection_flag:resolve" as const;
const FLAG_DISMISS = "inspection_flag:dismiss" as const;

export class FinancialRiskService {
  private readonly evaluators = createDefaultRuleEvaluators();

  constructor(
    private readonly authz: AuthorizationService,
    private readonly projectRepo: Pick<ProjectRepositoryPort, "findById" | "findAllActiveProjects">,
    private readonly inspectionRepo: Pick<InspectionRepositoryPort, "list">,
    private readonly inspectionService: Pick<InspectionService, "createInspection">,
    private readonly fundRepo: FundRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly docRepo: FinancialDocumentRepository,
    private readonly riskRepo: FinancialRiskRepository,
    private readonly flagRepo: InspectionFlagRepository,
  ) {}

  async evaluateProject(
    ctx: RequestUserContext,
    projectId: string,
  ): Promise<{
    flag: InspectionFlag | null;
    events: FinancialRiskEvent[];
    scoreOutput: ScoredRiskOutput;
  }> {
    this.authz.requirePermission(ctx, RISK_READ);

    const project = await this.projectRepo.findById(projectId);
    if (!project) throw AppError.notFound("Project not found");

    this.authz.requirePermission(ctx, RISK_READ, { districtId: project.districtId });

    // Load full financial context for evaluation
    const [allocationsResult, releases, expenses, documents, existingEvents, inspectionsResult] =
      await Promise.all([
        this.fundRepo.listAllocations({ projectId, pageSize: 1000 }),
        this.fundRepo.listReleasesByProject(projectId),
        this.expenseRepo.findByProject(projectId),
        this.docRepo.listByProject(projectId),
        this.riskRepo.listEventsByProject(projectId),
        this.inspectionRepo.list({ projectId, page: 1, pageSize: 1000 }),
      ]);

    const completedInspections = inspectionsResult.items.filter(
      (i) => i.status === "closed" || i.status === "submitted",
    ).length;

    const evaluationContext: RiskEvaluationContext = {
      projectId,
      organisationId: project.organisationId,
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        status: project.status,
        organisationId: project.organisationId,
        districtId: project.districtId,
        totalInspections: inspectionsResult.total,
        completedInspections,
        openFindings: 0,
        resolvedFindings: 0,
      },
      allocations: allocationsResult.items,
      releases,
      expenses,
      documents,
      existingEvents,
    };

    // Fetch active rules
    const rules = await this.riskRepo.listRules(true);

    const allResults: RuleEvaluationResult[] = [];
    for (const rule of rules) {
      const evaluator = this.evaluators.get(rule.code);
      if (evaluator) {
        try {
          const ruleResults = await evaluator.evaluate(evaluationContext, rule);
          allResults.push(...ruleResults);
        } catch {
          // Log rule error without failing evaluation
        }
      }
    }

    const scoreOutput = scoreRiskResults(allResults);

    let recordedEvents: FinancialRiskEvent[] = [];
    let flag: InspectionFlag | null = null;

    if (scoreOutput.triggeredResults.length > 0) {
      // 1. Batch record new risk events
      recordedEvents = await this.riskRepo.createRiskEvents(
        scoreOutput.triggeredResults.map((r) => {
          const rule = rules.find((rl) => rl.code === r.ruleCode);
          return {
            ruleId: rule?.id ?? r.ruleCode,
            projectId,
            organisationId: project.organisationId,
            expenseId: r.expenseId,
            documentId: r.documentId,
            allocationId: r.allocationId,
            scoreContribution: r.scoreContribution,
            detail: r.detail,
          };
        }),
      );

      // 2. Manage Inspection Flag
      const existingOpenFlag = await this.flagRepo.findOpenFlagByProject(projectId);

      if (existingOpenFlag) {
        // Update existing open flag
        flag = await this.flagRepo.updateWithAudit({
          id: existingOpenFlag.id,
          riskScore: scoreOutput.totalScore,
          riskLevel: scoreOutput.riskLevel,
          explanation: scoreOutput.explanation,
          evidenceRefs: scoreOutput.evidenceRefs,
          actorUserId: ctx.userId,
          requestId: ctx.requestId ?? null,
          ipAddress: ctx.ipAddress ?? null,
          auditAction: "financial_risk.flag_created",
          auditMetadata: {
            projectId,
            previousScore: existingOpenFlag.riskScore,
            newScore: scoreOutput.totalScore,
            updated: true,
          },
          eventType: "inspection_flag.created",
          eventPayload: {
            flagId: existingOpenFlag.id,
            projectId,
            riskScore: scoreOutput.totalScore,
          },
        });
      } else {
        // Create new flag
        flag = await this.flagRepo.createWithAudit({
          projectId,
          organisationId: project.organisationId,
          riskScore: scoreOutput.totalScore,
          riskLevel: scoreOutput.riskLevel,
          triggerSource: "risk_engine",
          explanation: scoreOutput.explanation,
          evidenceRefs: scoreOutput.evidenceRefs,
          actorUserId: ctx.userId,
          requestId: ctx.requestId ?? null,
          ipAddress: ctx.ipAddress ?? null,
          auditAction: "financial_risk.flag_created",
          auditMetadata: {
            projectId,
            riskScore: scoreOutput.totalScore,
            riskLevel: scoreOutput.riskLevel,
          },
          eventType: "inspection_flag.created",
          eventPayload: {
            projectId,
            riskScore: scoreOutput.totalScore,
            riskLevel: scoreOutput.riskLevel,
          },
        });
      }
    }

    return { flag, events: recordedEvents, scoreOutput };
  }

  /** Scheduled sweep: evaluate the financial risk engine across all active projects. */
  async sweepAllActiveProjects(
    ctx: RequestUserContext,
  ): Promise<{ evaluatedCount: number }> {
    this.authz.requirePermission(ctx, RISK_READ);

    const activeProjects = await this.projectRepo.findAllActiveProjects();
    let evaluatedCount = 0;

    for (const project of activeProjects) {
      try {
        await this.evaluateProject(ctx, project.id);
        evaluatedCount++;
      } catch {
        // Continue processing other projects
      }
    }

    return { evaluatedCount };
  }

  /* ---------- Flag Management ---------- */

  async listFlags(
    ctx: RequestUserContext,
    query: InspectionFlagListQuery,
  ): Promise<{ items: InspectionFlag[]; total: number; page: number; pageSize: number }> {
    this.authz.requirePermission(ctx, FLAG_READ);
    const scope = this.authz.accessibleDistrictIds(ctx);
    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const result = await this.flagRepo.list(
      { ...query, page: pageNum, pageSize },
      scope ? [...scope] : undefined,
    );
    return { items: result.items, total: result.total, page: pageNum, pageSize };
  }

  async getFlag(ctx: RequestUserContext, id: string): Promise<InspectionFlag> {
    this.authz.requirePermission(ctx, FLAG_READ);
    const flag = await this.flagRepo.findById(id);
    if (!flag) throw AppError.notFound("Inspection flag not found");

    const project = await this.projectRepo.findById(flag.projectId);
    this.authz.requirePermission(ctx, FLAG_READ, { districtId: project?.districtId });
    return flag;
  }

  async assignFlag(
    ctx: RequestUserContext,
    id: string,
    inspectorId: string,
  ): Promise<InspectionFlag> {
    const flag = await this.getFlag(ctx, id);
    const project = await this.projectRepo.findById(flag.projectId);
    this.authz.requirePermission(ctx, FLAG_ASSIGN, { districtId: project?.districtId });

    if (flag.status === "resolved" || flag.status === "dismissed") {
      throw AppError.conflict("Cannot assign a resolved or dismissed inspection flag");
    }

    return this.flagRepo.assignWithAudit({
      id,
      assignedInspectorId: inspectorId,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "financial_risk.flag_assigned",
      auditMetadata: { flagId: id, assignedInspectorId: inspectorId },
      eventType: "inspection_flag.assigned",
      eventPayload: { flagId: id, assignedInspectorId: inspectorId },
    });
  }

  async createInspectionFromFlag(
    ctx: RequestUserContext,
    flagId: string,
    opts?: {
      templateId?: string | null;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
    },
  ): Promise<{ flag: InspectionFlag; inspection: Inspection }> {
    const flag = await this.getFlag(ctx, flagId);

    if (flag.status === "resolved" || flag.status === "dismissed") {
      throw AppError.conflict("Cannot launch inspection for a resolved or dismissed flag");
    }

    const inspection = await this.inspectionService.createInspection(ctx, {
      projectId: flag.projectId,
      type: "special",
      trigger: "risk_engine",
      templateId: opts?.templateId ?? null,
      scheduledStart: opts?.scheduledStart ?? null,
      scheduledEnd: opts?.scheduledEnd ?? null,
      assigneeUserIds: flag.assignedInspectorId ? [flag.assignedInspectorId] : undefined,
    });

    const updatedFlag = await this.flagRepo.linkInspectionWithAudit(
      flag.id,
      inspection.id,
      ctx.userId,
    );

    return { flag: updatedFlag, inspection };
  }

  async reviewFlag(
    ctx: RequestUserContext,
    id: string,
    reviewNotes: string,
    status?: InspectionFlagStatus,
  ): Promise<InspectionFlag> {
    const flag = await this.getFlag(ctx, id);
    const project = await this.projectRepo.findById(flag.projectId);
    this.authz.requirePermission(ctx, FLAG_REVIEW, { districtId: project?.districtId });

    return this.flagRepo.reviewWithAudit({
      id,
      reviewNotes,
      status,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "financial_risk.rule_triggered",
      auditMetadata: { flagId: id, reviewNotes },
      eventType: "inspection_flag.created",
      eventPayload: { flagId: id },
    });
  }

  async resolveFlag(
    ctx: RequestUserContext,
    id: string,
    resolution: string,
  ): Promise<InspectionFlag> {
    const flag = await this.getFlag(ctx, id);
    const project = await this.projectRepo.findById(flag.projectId);
    this.authz.requirePermission(ctx, FLAG_RESOLVE, { districtId: project?.districtId });

    return this.flagRepo.resolveWithAudit({
      id,
      resolution,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "financial_risk.flag_resolved",
      auditMetadata: { flagId: id, resolution },
      eventType: "inspection_flag.resolved",
      eventPayload: { flagId: id, resolution },
    });
  }

  async dismissFlag(
    ctx: RequestUserContext,
    id: string,
    dismissedReason: string,
  ): Promise<InspectionFlag> {
    const flag = await this.getFlag(ctx, id);
    const project = await this.projectRepo.findById(flag.projectId);
    this.authz.requirePermission(ctx, FLAG_DISMISS, { districtId: project?.districtId });

    return this.flagRepo.dismissWithAudit({
      id,
      dismissedReason,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "financial_risk.flag_dismissed",
      auditMetadata: { flagId: id, dismissedReason },
      eventType: "inspection_flag.dismissed",
      eventPayload: { flagId: id, dismissedReason },
    });
  }

  /* ---------- Rule Management ---------- */

  async listRules(
    ctx: RequestUserContext,
    enabledOnly: boolean = false,
  ): Promise<FinancialRiskRule[]> {
    this.authz.requirePermission(ctx, RISK_READ);
    return this.riskRepo.listRules(enabledOnly);
  }

  async getRule(ctx: RequestUserContext, id: string): Promise<FinancialRiskRule> {
    this.authz.requirePermission(ctx, RISK_READ);
    const rule = await this.riskRepo.findRuleById(id);
    if (!rule) throw AppError.notFound("Financial risk rule not found");
    return rule;
  }

  async createRule(
    ctx: RequestUserContext,
    input: CreateRiskRuleInput,
  ): Promise<FinancialRiskRule> {
    this.authz.requirePermission(ctx, RISK_CONFIGURE);

    const existing = await this.riskRepo.findRuleByCode(input.code);
    if (existing) throw AppError.conflict(`Rule with code ${input.code} already exists`);

    return this.riskRepo.createRule({
      code: input.code,
      name: input.name,
      category: input.category,
      description: input.description,
      conditionConfig: input.conditionConfig,
      weight: input.weight,
      severity: input.severity,
      enabled: input.enabled ?? true,
      actorUserId: ctx.userId,
    });
  }

  async updateRule(
    ctx: RequestUserContext,
    id: string,
    input: PatchRiskRuleInput,
  ): Promise<FinancialRiskRule> {
    this.authz.requirePermission(ctx, RISK_CONFIGURE);
    await this.getRule(ctx, id);

    return this.riskRepo.updateRule({
      id,
      name: input.name,
      category: input.category,
      description: input.description,
      conditionConfig: input.conditionConfig,
      weight: input.weight,
      severity: input.severity,
      enabled: input.enabled,
      actorUserId: ctx.userId,
    });
  }

  async listEventsByProject(
    ctx: RequestUserContext,
    projectId: string,
  ): Promise<FinancialRiskEvent[]> {
    this.authz.requirePermission(ctx, RISK_READ);
    const project = await this.projectRepo.findById(projectId);
    if (!project) throw AppError.notFound("Project not found");
    this.authz.requirePermission(ctx, RISK_READ, { districtId: project.districtId });
    return this.riskRepo.listEventsByProject(projectId);
  }
}
