import type { ProjectRiskEvaluationContext } from "./project-risk-context.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { InspectionRepositoryPort } from "../../inspections/application/ports/inspection-repository.js";
import type {
  FindingRepository,
  CorrectiveActionRepository,
  AttendanceRepository,
  ComplaintRepository,
  AiAnomalyRepository,
  FinancialRiskRepository,
  FundRepository,
  ExpenseRepository,
} from "@netram/data";
import type { FinancialRiskService } from "../../financial-risk/application/financial-risk-service.js";
import { DEFAULT_OBSERVATION_WINDOWS } from "../config/risk-config.js";
import { AppError } from "../../../infrastructure/errors.js";

export class ProjectRiskContextBuilder {
  constructor(
    private readonly projectRepo: Pick<ProjectRepositoryPort, "findById">,
    private readonly inspectionRepo: Pick<InspectionRepositoryPort, "list">,
    private readonly findingRepo: FindingRepository,
    private readonly correctiveActionRepo: CorrectiveActionRepository,
    private readonly attendanceRepo: AttendanceRepository,
    private readonly complaintRepo: ComplaintRepository,
    private readonly aiAnomalyRepo: AiAnomalyRepository,
    private readonly financialRiskRepo: FinancialRiskRepository,
    private readonly fundRepo: FundRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly financialRiskService: FinancialRiskService,
  ) {}

  async buildContext(
    ctx: RequestUserContext,
    projectId: string,
  ): Promise<ProjectRiskEvaluationContext> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project ${projectId} not found`);
    }

    const now = new Date();
    const attendanceFrom = new Date(
      now.getTime() - DEFAULT_OBSERVATION_WINDOWS.attendanceDays * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split("T")[0];
    const complaintsFrom = new Date(
      now.getTime() - DEFAULT_OBSERVATION_WINDOWS.complaintDays * 24 * 60 * 60 * 1000,
    );
    const aiFrom = new Date(
      now.getTime() - DEFAULT_OBSERVATION_WINDOWS.aiAnomalyDays * 24 * 60 * 60 * 1000,
    );

    // Run parallel evaluations/queries
    const [
      financialEval,
      activeRules,
      allocationsResult,
      expensesResult,
      inspectionsResult,
      attendanceResult,
      complaintsResult,
      aiAnomaliesResult,
    ] = await Promise.all([
      this.financialRiskService.evaluateProject(ctx, projectId).catch(() => ({
        flag: null,
        events: [],
        scoreOutput: {
          totalScore: 0,
          riskLevel: "low",
          explanation: "No financial evaluation available",
          evidenceRefs: [],
          triggeredResults: [],
        },
      })),
      this.financialRiskRepo.listRules(true).catch(() => []),
      this.fundRepo.listAllocations({ projectId, pageSize: 1 }).catch(() => ({ total: 0, items: [] })),
      this.expenseRepo.findByProject(projectId).catch(() => []),
      this.inspectionRepo.list({ projectId, page: 1, pageSize: 1000 }),
      this.attendanceRepo
        .listAnomalies({
          projectId,
          from: attendanceFrom,
          page: 1,
          pageSize: 1000,
        })
        .catch(() => ({ items: [], total: 0 })),
      this.complaintRepo
        .list({
          projectId,
          page: 1,
          pageSize: 1000,
        })
        .catch(() => ({ items: [], total: 0 })),
      this.aiAnomalyRepo
        .list({
          projectId,
          page: 1,
          pageSize: 1000,
        })
        .catch(() => ({ items: [], total: 0 })),
    ]);

    // Gather findings for all inspections
    const inspectionList = inspectionsResult.items;
    const findingsPromises = inspectionList.map((insp) =>
      this.findingRepo.listByInspection(insp.id).catch(() => []),
    );
    const allFindingsArrays = await Promise.all(findingsPromises);
    const allFindings = allFindingsArrays.flat();

    // Gather corrective actions for all findings
    const caPromises = allFindings.map((f) =>
      this.correctiveActionRepo.list({ findingId: f.id, page: 1, pageSize: 50 }).catch(() => ({ items: [], total: 0 })),
    );
    const caResults = await Promise.all(caPromises);
    const allCorrectiveActions = caResults.flatMap((r) => r.items);

    // Filter complaints within window
    const windowComplaints = complaintsResult.items.filter(
      (c) => new Date(c.receivedAt) >= complaintsFrom,
    );

    // Filter AI anomalies within window
    const windowAiAnomalies = aiAnomaliesResult.items.filter(
      (a) => new Date(a.createdAt) >= aiFrom,
    );

    // Calculate maximum possible raw score from active rules
    const maxPossibleRawScore = activeRules.reduce((sum, r) => sum + r.weight, 0);

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        districtId: project.districtId,
        organisationId: project.organisationId,
        createdAt: project.createdAt,
      },
      financial: {
        totalScore: financialEval.scoreOutput.totalScore,
        riskLevel: financialEval.scoreOutput.riskLevel,
        triggeredRules: (financialEval.scoreOutput.triggeredResults ?? []).map((tr) => ({
          ruleCode: tr.ruleCode,
          ruleName: tr.ruleName,
          scoreContribution: tr.scoreContribution,
          detail: tr.detail,
        })),
        maxPossibleRawScore: maxPossibleRawScore > 0 ? maxPossibleRawScore : 220,
        allocationsCount: allocationsResult.total,
        expensesCount: expensesResult.length,
        flagId: financialEval.flag ? financialEval.flag.id : null,
      },
      inspections: {
        inspections: inspectionList.map((i) => ({
          id: i.id,
          status: i.status,
          scheduledStart: i.scheduledStart,
          startedAt: i.startedAt,
          submittedAt: i.submittedAt,
          createdAt: i.createdAt,
        })),
        findings: allFindings.map((f) => ({
          id: f.id,
          inspectionId: f.inspectionId,
          severity: f.severity,
          status: f.status,
        })),
        correctiveActions: allCorrectiveActions.map((ca) => ({
          id: ca.id,
          findingId: ca.findingId,
          status: ca.status,
          deadline: ca.deadline,
        })),
      },
      attendance: {
        anomalies: attendanceResult.items.map((a) => ({
          id: a.id,
          anomalyType: a.anomalyType,
          severity: a.severity,
          state: a.state,
          operationalDate: a.operationalDate,
        })),
      },
      complaints: {
        complaints: windowComplaints.map((c) => ({
          id: c.id,
          status: c.status,
          receivedAt: c.receivedAt,
        })),
      },
      aiAnomalies: {
        anomalies: windowAiAnomalies.map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          status: a.status,
          confidence: a.confidence,
          createdAt: a.createdAt,
        })),
      },
    };
  }
}
