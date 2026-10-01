import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type {
  FundRepository,
  ExpenseRepository,
  FinancialRiskRepository,
  InspectionFlagRepository,
} from "@netram/data";
import type {
  FundAllocation,
  FundRelease,
  FundSummary,
  ProjectFundOverview,
  AllocationListQuery,
} from "@netram/types";
import type {
  CreateAllocationInput,
  UpdateAllocationInput,
  CreateReleaseInput,
} from "@netram/validation";

const FUND_READ = "fund:read" as const;
const FUND_ALLOCATE = "fund:allocate" as const;
const FUND_RELEASE = "fund:release" as const;

/**
 * Inspection flags are oversight instruments against the establishment, not
 * part of its own financial dossier (§34). They are disclosed only to
 * oversight holders; the inspected organisation does not see them here.
 */
const RISK_READ_PERMISSIONS = ["financial_risk:read", "project_risk:read"] as const;

function canViewRiskFlags(ctx: RequestUserContext): boolean {
  return RISK_READ_PERMISSIONS.some((p) => ctx.permissions.has(p));
}

export class FundService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly projectRepo: Pick<ProjectRepositoryPort, "findById">,
    private readonly fundRepo: FundRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly riskRepo: FinancialRiskRepository,
    private readonly flagRepo: InspectionFlagRepository,
  ) {}

  async listAllocations(
    ctx: RequestUserContext,
    query: AllocationListQuery,
  ): Promise<{ items: FundAllocation[]; total: number; page: number; pageSize: number }> {
    this.authz.requirePermission(ctx, FUND_READ);
    const scope = this.authz.accessibleDistrictIds(ctx);
    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const result = await this.fundRepo.listAllocations(
      { ...query, page: pageNum, pageSize },
      scope ? [...scope] : undefined,
    );
    return { items: result.items, total: result.total, page: pageNum, pageSize };
  }

  async getAllocation(ctx: RequestUserContext, id: string): Promise<FundAllocation> {
    const allocation = await this.fundRepo.findAllocationById(id);
    if (!allocation) throw AppError.notFound("Fund allocation not found");

    const project = await this.projectRepo.findById(allocation.projectId);
    this.authz.requirePermission(ctx, FUND_READ, { districtId: project?.districtId });
    return allocation;
  }

  async createAllocation(
    ctx: RequestUserContext,
    input: CreateAllocationInput,
  ): Promise<FundAllocation> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw AppError.notFound("Project not found");
    this.authz.requirePermission(ctx, FUND_ALLOCATE, { districtId: project.districtId });

    const amount = parseFloat(input.allocatedAmount);
    if (isNaN(amount) || amount <= 0) {
      throw AppError.badRequest("Allocated amount must be a positive decimal");
    }

    return this.fundRepo.createAllocationWithAudit({
      projectId: input.projectId,
      programmeId: input.programmeId ?? null,
      organisationId: input.organisationId ?? project.organisationId ?? null,
      allocatedAmount: input.allocatedAmount,
      fiscalYear: input.fiscalYear,
      currency: input.currency ?? "INR",
      sanctionedById: ctx.userId,
      sanctionedAt: new Date(),
      scheme: input.scheme ?? null,
      description: input.description ?? null,
      notes: input.notes ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "fund.allocation_created",
      auditMetadata: {
        projectId: input.projectId,
        allocatedAmount: input.allocatedAmount,
        fiscalYear: input.fiscalYear,
      },
      eventType: "fund.allocated",
      eventPayload: {
        projectId: input.projectId,
        allocatedAmount: input.allocatedAmount,
      },
    });
  }

  async updateAllocation(
    ctx: RequestUserContext,
    id: string,
    input: UpdateAllocationInput,
  ): Promise<FundAllocation> {
    const allocation = await this.getAllocation(ctx, id);
    const project = await this.projectRepo.findById(allocation.projectId);
    this.authz.requirePermission(ctx, FUND_ALLOCATE, { districtId: project?.districtId });

    if (input.allocatedAmount !== undefined) {
      const amount = parseFloat(input.allocatedAmount);
      if (isNaN(amount) || amount <= 0) {
        throw AppError.badRequest("Allocated amount must be a positive decimal");
      }
    }

    return this.fundRepo.updateAllocationWithAudit({
      id,
      allocatedAmount: input.allocatedAmount,
      status: input.status,
      scheme: input.scheme,
      description: input.description,
      notes: input.notes,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "fund.allocation_revised",
      auditMetadata: {
        allocationId: id,
        previousAmount: allocation.allocatedAmount,
        newAmount: input.allocatedAmount,
        status: input.status,
      },
      eventType: "fund.revised",
      eventPayload: {
        allocationId: id,
        allocatedAmount: input.allocatedAmount ?? allocation.allocatedAmount,
      },
    });
  }

  async listReleases(ctx: RequestUserContext, allocationId: string): Promise<FundRelease[]> {
    this.authz.requirePermission(ctx, FUND_READ);
    await this.getAllocation(ctx, allocationId);
    return this.fundRepo.listReleasesByAllocationId(allocationId);
  }

  async createRelease(ctx: RequestUserContext, input: CreateReleaseInput): Promise<FundRelease> {
    const allocation = await this.getAllocation(ctx, input.allocationId);
    const project = await this.projectRepo.findById(allocation.projectId);
    this.authz.requirePermission(ctx, FUND_RELEASE, { districtId: project?.districtId });

    if (allocation.status !== "active") {
      throw AppError.conflict(
        `Cannot release funds against allocation in '${allocation.status}' status`,
      );
    }

    const existingRef = await this.fundRepo.findReleaseByReference(input.referenceNumber);
    if (existingRef) {
      throw AppError.conflict(`Release with reference '${input.referenceNumber}' already exists`);
    }

    const releaseAmount = parseFloat(input.releasedAmount);
    if (isNaN(releaseAmount) || releaseAmount <= 0) {
      throw AppError.badRequest("Released amount must be a positive decimal");
    }

    const existingReleases = await this.fundRepo.listReleasesByAllocationId(input.allocationId);
    const currentReleasedSum = existingReleases
      .filter((r) => r.status === "released")
      .reduce((sum, r) => sum + parseFloat(r.releasedAmount || "0"), 0);

    const allocatedAmount = parseFloat(allocation.allocatedAmount || "0");
    if (currentReleasedSum + releaseAmount > allocatedAmount) {
      throw AppError.badRequest(
        `Total released amount (₹${(currentReleasedSum + releaseAmount).toLocaleString("en-IN")}) cannot exceed allocated budget (₹${allocatedAmount.toLocaleString("en-IN")})`,
      );
    }

    return this.fundRepo.createReleaseWithAudit({
      allocationId: input.allocationId,
      releasedAmount: input.releasedAmount,
      releaseDate: new Date(input.releaseDate),
      referenceNumber: input.referenceNumber,
      remarks: input.remarks ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "fund.release_created",
      auditMetadata: {
        allocationId: input.allocationId,
        releasedAmount: input.releasedAmount,
        referenceNumber: input.referenceNumber,
      },
      eventType: "fund.released",
      eventPayload: {
        allocationId: input.allocationId,
        releasedAmount: input.releasedAmount,
        referenceNumber: input.referenceNumber,
      },
    });
  }

  async reverseRelease(
    ctx: RequestUserContext,
    id: string,
    remarks?: string,
  ): Promise<FundRelease> {
    const release = await this.fundRepo.findReleaseById(id);
    if (!release) throw AppError.notFound("Fund release not found");

    if (release.status === "reversed") {
      throw AppError.conflict("Fund release has already been reversed");
    }

    const allocation = await this.getAllocation(ctx, release.allocationId);
    const project = await this.projectRepo.findById(allocation.projectId);
    this.authz.requirePermission(ctx, FUND_RELEASE, { districtId: project?.districtId });

    return this.fundRepo.reverseReleaseWithAudit({
      id,
      remarks: remarks ?? "Release reversed by authority",
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "fund.release_reversed",
      auditMetadata: { releaseId: id, referenceNumber: release.referenceNumber },
      eventType: "fund.reversed",
      eventPayload: { releaseId: id, referenceNumber: release.referenceNumber },
    });
  }

  async getProjectSummary(ctx: RequestUserContext, projectId: string): Promise<FundSummary> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) throw AppError.notFound("Project not found");
    this.authz.requirePermission(ctx, FUND_READ, { districtId: project.districtId });
    return this.fundRepo.getProjectFundSummary(projectId);
  }

  async getProjectOverview(
    ctx: RequestUserContext,
    projectId: string,
  ): Promise<ProjectFundOverview> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) throw AppError.notFound("Project not found");
    this.authz.requirePermission(ctx, FUND_READ, { districtId: project.districtId });

    const [summary, allocationsResult, expenses, riskEvents, flagsResult] = await Promise.all([
      this.fundRepo.getProjectFundSummary(projectId),
      this.fundRepo.listAllocations({ projectId, pageSize: 100 }),
      this.expenseRepo.findByProject(projectId),
      this.riskRepo.listEventsByProject(projectId),
      this.flagRepo.list({ projectId, pageSize: 100 }),
    ]);

    return {
      summary,
      allocations: allocationsResult.items,
      recentExpenses: expenses.slice(0, 10),
      recentRiskEvents: canViewRiskFlags(ctx) ? riskEvents.slice(0, 10) : [],
      activeFlags: canViewRiskFlags(ctx)
        ? flagsResult.items.filter((f) => f.status !== "resolved" && f.status !== "dismissed")
        : [],
    };
  }
}
