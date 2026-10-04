import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { ExpenseRepository, FundRepository } from "@netram/data";
import type { Expense, ExpenseListQuery } from "@netram/types";
import type { CreateExpenseInput, PatchExpenseInput } from "@netram/validation";

const EXPENSE_READ = "expense:read" as const;
const EXPENSE_SUBMIT = "expense:submit" as const;
const EXPENSE_VERIFY = "expense:verify" as const;
const EXPENSE_VOID = "expense:void" as const;

export class ExpenseService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly projectRepo: Pick<ProjectRepositoryPort, "findById">,
    private readonly expenseRepo: ExpenseRepository,
    private readonly fundRepo: FundRepository,
  ) {}

  async listExpenses(
    ctx: RequestUserContext,
    query: ExpenseListQuery,
  ): Promise<{ items: Expense[]; total: number; page: number; pageSize: number }> {
    this.authz.requirePermission(ctx, EXPENSE_READ);
    const scope = this.authz.accessibleDistrictIds(ctx);
    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const result = await this.expenseRepo.list(
      { ...query, page: pageNum, pageSize },
      scope ? [...scope] : undefined,
    );
    return { items: result.items, total: result.total, page: pageNum, pageSize };
  }

  async getExpense(ctx: RequestUserContext, id: string): Promise<Expense> {
    this.authz.requirePermission(ctx, EXPENSE_READ);
    const expense = await this.expenseRepo.findById(id);
    if (!expense) throw AppError.notFound("Expense not found");

    const project = await this.projectRepo.findById(expense.projectId);
    this.authz.requirePermission(ctx, EXPENSE_READ, { districtId: project?.districtId });
    return expense;
  }

  async createExpense(ctx: RequestUserContext, input: CreateExpenseInput): Promise<Expense> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw AppError.notFound("Project not found");
    this.authz.requirePermission(ctx, EXPENSE_SUBMIT, { districtId: project.districtId });

    const amount = parseFloat(input.amount);
    if (isNaN(amount) || amount <= 0) {
      throw AppError.badRequest("Expense amount must be a positive decimal");
    }

    if (input.invoiceNumber) {
      const existing = await this.expenseRepo.findByInvoiceNumber(
        input.projectId,
        input.invoiceNumber,
      );
      if (existing && existing.status !== "voided") {
        throw AppError.conflict(
          `An expense with invoice number '${input.invoiceNumber}' already exists for this project`,
        );
      }
    }

    if (input.allocationId) {
      const alloc = await this.fundRepo.findAllocationById(input.allocationId);
      if (!alloc) throw AppError.notFound("Fund allocation not found");
      if (alloc.projectId !== input.projectId) {
        throw AppError.badRequest("Allocation does not belong to specified project");
      }
    }

    return this.expenseRepo.createWithAudit({
      projectId: input.projectId,
      organisationId: input.organisationId ?? project.organisationId ?? null,
      allocationId: input.allocationId ?? null,
      category: input.category,
      description: input.description,
      amount: input.amount,
      transactionDate: new Date(input.transactionDate),
      vendorName: input.vendorName,
      vendorGstin: input.vendorGstin ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,
      paymentReference: input.paymentReference ?? null,
      paymentMethod: input.paymentMethod ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "expense.created",
      auditMetadata: {
        projectId: input.projectId,
        amount: input.amount,
        vendorName: input.vendorName,
      },
      eventType: "expense.created",
      eventPayload: {
        projectId: input.projectId,
        amount: input.amount,
        category: input.category,
      },
    });
  }

  async updateExpense(
    ctx: RequestUserContext,
    id: string,
    input: PatchExpenseInput,
  ): Promise<Expense> {
    const existing = await this.getExpense(ctx, id);
    const project = await this.projectRepo.findById(existing.projectId);
    this.authz.requirePermission(ctx, EXPENSE_SUBMIT, { districtId: project?.districtId });

    // Hard constraint: Verified expense records are immutable to institutions!
    if (existing.status === "verified") {
      throw AppError.conflict("Verified expense records are immutable and cannot be modified.");
    }
    if (existing.status === "voided") {
      throw AppError.conflict("Voided expense records cannot be modified.");
    }

    if (input.amount !== undefined) {
      const amount = parseFloat(input.amount);
      if (isNaN(amount) || amount <= 0) {
        throw AppError.badRequest("Expense amount must be a positive decimal");
      }
    }

    return this.expenseRepo.updateWithAudit({
      id,
      category: input.category,
      description: input.description,
      amount: input.amount,
      transactionDate: input.transactionDate ? new Date(input.transactionDate) : undefined,
      vendorName: input.vendorName,
      vendorGstin: input.vendorGstin,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : undefined,
      paymentReference: input.paymentReference,
      paymentMethod: input.paymentMethod,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "expense.created", // modification logged
      auditMetadata: {
        expenseId: id,
        updatedFields: Object.keys(input),
      },
      eventType: "expense.created",
      eventPayload: {
        expenseId: id,
      },
    });
  }

  async submitExpense(ctx: RequestUserContext, id: string): Promise<Expense> {
    const existing = await this.getExpense(ctx, id);
    const project = await this.projectRepo.findById(existing.projectId);
    this.authz.requirePermission(ctx, EXPENSE_SUBMIT, { districtId: project?.districtId });

    if (existing.status !== "draft" && existing.status !== "rejected") {
      throw AppError.conflict(`Cannot submit expense currently in '${existing.status}' status`);
    }

    return this.expenseRepo.transitionStatusWithAudit({
      id,
      status: "submitted",
      submittedById: ctx.userId,
      submittedAt: new Date(),
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "expense.submitted",
      auditMetadata: { expenseId: id },
      eventType: "expense.submitted",
      eventPayload: { expenseId: id, status: "submitted" },
    });
  }

  async verifyExpense(ctx: RequestUserContext, id: string): Promise<Expense> {
    const existing = await this.getExpense(ctx, id);
    const project = await this.projectRepo.findById(existing.projectId);
    this.authz.requirePermission(ctx, EXPENSE_VERIFY, { districtId: project?.districtId });

    // Enforce separation of duties: Institutions/agencies cannot verify their own expenditure
    const isInstitution = ctx.assignments.some((a) => a.roleCode === "institution_admin");
    if (isInstitution) {
      throw AppError.forbidden(
        "Institutions/agencies cannot verify expenditures. Verification must be performed by an Authorized Officer or Auditor.",
      );
    }

    // Prohibit self-verification (maker-checker rule)
    if (existing.submittedById && existing.submittedById === ctx.userId) {
      throw AppError.forbidden(
        "Self-verification is prohibited. The officer verifying an expenditure cannot be the user who submitted it.",
      );
    }

    if (existing.status === "verified") {
      return existing;
    }
    if (existing.status === "voided") {
      throw AppError.conflict("Cannot verify a voided expense");
    }

    return this.expenseRepo.transitionStatusWithAudit({
      id,
      status: "verified",
      verifiedById: ctx.userId,
      verifiedAt: new Date(),
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "expense.verified",
      auditMetadata: { expenseId: id },
      eventType: "expense.verified",
      eventPayload: { expenseId: id, status: "verified" },
    });
  }

  async rejectExpense(ctx: RequestUserContext, id: string, reason: string): Promise<Expense> {
    const existing = await this.getExpense(ctx, id);
    const project = await this.projectRepo.findById(existing.projectId);
    this.authz.requirePermission(ctx, EXPENSE_VERIFY, { districtId: project?.districtId });

    // Enforce separation of duties: Institutions/agencies cannot reject expenditures
    const isInstitution = ctx.assignments.some((a) => a.roleCode === "institution_admin");
    if (isInstitution) {
      throw AppError.forbidden(
        "Institutions/agencies cannot reject expenditures. This action must be performed by an Authorized Officer or Auditor.",
      );
    }

    if (existing.status === "voided") {
      throw AppError.conflict("Cannot reject a voided expense");
    }

    return this.expenseRepo.transitionStatusWithAudit({
      id,
      status: "rejected",
      voidReason: reason,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "expense.rejected",
      auditMetadata: { expenseId: id, rejectionReason: reason },
      eventType: "expense.rejected",
      eventPayload: { expenseId: id, status: "rejected", reason },
    });
  }

  async voidExpense(ctx: RequestUserContext, id: string, voidReason: string): Promise<Expense> {
    const existing = await this.getExpense(ctx, id);
    const project = await this.projectRepo.findById(existing.projectId);
    this.authz.requirePermission(ctx, EXPENSE_VOID, { districtId: project?.districtId });

    if (!voidReason || !voidReason.trim()) {
      throw AppError.badRequest("A valid justification is required to void an expense record");
    }

    if (existing.status === "voided") {
      throw AppError.conflict("Expense record is already voided");
    }

    return this.expenseRepo.transitionStatusWithAudit({
      id,
      status: "voided",
      voidReason: voidReason.trim(),
      voidedById: ctx.userId,
      voidedAt: new Date(),
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "expense.voided",
      auditMetadata: { expenseId: id, voidReason },
      eventType: "expense.voided",
      eventPayload: { expenseId: id, status: "voided", voidReason },
    });
  }
}
