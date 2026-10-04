import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  expenses as expensesTable,
  projects as projectsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  Expense,
  ExpenseStatus,
  ExpenseListQuery,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface ExpenseRow {
  id: string;
  projectId: string;
  organisationId: string | null;
  allocationId: string | null;
  category: string;
  description: string;
  amount: string;
  transactionDate: Date;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  status: ExpenseStatus;
  submittedById: string | null;
  submittedAt: Date | null;
  verifiedById: string | null;
  verifiedAt: Date | null;
  voidReason: string | null;
  voidedById: string | null;
  voidedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    projectId: row.projectId,
    organisationId: row.organisationId,
    allocationId: row.allocationId,
    category: row.category,
    description: row.description,
    amount: row.amount,
    transactionDate: row.transactionDate.toISOString(),
    vendorName: row.vendorName,
    vendorGstin: row.vendorGstin,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate ? row.invoiceDate.toISOString() : null,
    paymentReference: row.paymentReference,
    paymentMethod: row.paymentMethod,
    status: row.status,
    submittedById: row.submittedById,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    verifiedById: row.verifiedById,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    voidReason: row.voidReason,
    voidedById: row.voidedById,
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface ExpenseWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateExpenseWrite extends ExpenseWriteContext {
  id?: string;
  projectId: string;
  organisationId?: string | null;
  allocationId?: string | null;
  category: string;
  description: string;
  amount: string;
  transactionDate: Date;
  vendorName: string;
  vendorGstin?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
}

export interface UpdateExpenseWrite extends ExpenseWriteContext {
  id: string;
  category?: string;
  description?: string;
  amount?: string;
  transactionDate?: Date;
  vendorName?: string;
  vendorGstin?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
}

export interface TransitionExpenseWrite extends ExpenseWriteContext {
  id: string;
  status: ExpenseStatus;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  submittedById?: string | null;
  submittedAt?: Date | null;
  voidReason?: string | null;
  voidedById?: string | null;
  voidedAt?: Date | null;
}

export class ExpenseRepository {
  constructor(private db: DrizzleDB) {}

  async list(
    filter: ExpenseListQuery,
    jurisdictionDistrictIds?: string[],
  ): Promise<{ items: Expense[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.projectId) conditions.push(eq(expensesTable.projectId, filter.projectId));
    if (filter.organisationId)
      conditions.push(eq(expensesTable.organisationId, filter.organisationId));
    if (filter.allocationId) conditions.push(eq(expensesTable.allocationId, filter.allocationId));
    if (filter.status) conditions.push(eq(expensesTable.status, filter.status));
    if (filter.category) conditions.push(eq(expensesTable.category, filter.category));
    if (filter.vendorName) conditions.push(eq(expensesTable.vendorName, filter.vendorName));

    const whereClauses = [...conditions];
    if (filter.startDate)
      whereClauses.push(gte(expensesTable.transactionDate, new Date(filter.startDate)));
    if (filter.endDate)
      whereClauses.push(lte(expensesTable.transactionDate, new Date(filter.endDate)));

    const where = and(...whereClauses);
    const joinScope = jurisdictionDistrictIds?.length
      ? inArray(projectsTable.districtId, jurisdictionDistrictIds)
      : undefined;

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    const [rows, count] = await Promise.all([
      this.db
        .select({ expense: expensesTable })
        .from(expensesTable)
        .innerJoin(projectsTable, eq(expensesTable.projectId, projectsTable.id))
        .where(and(where, joinScope))
        .orderBy(desc(expensesTable.transactionDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(expensesTable)
        .innerJoin(projectsTable, eq(expensesTable.projectId, projectsTable.id))
        .where(and(where, joinScope)),
    ]);

    const items = rows.map((r) => toExpense(r.expense as unknown as ExpenseRow));
    return { items, total: count[0]?.count ?? 0 };
  }

  async findById(id: string): Promise<Expense | null> {
    const rows = await this.db
      .select()
      .from(expensesTable)
      .where(eq(expensesTable.id, id))
      .limit(1);
    if (!rows[0]) return null;
    return toExpense(rows[0] as unknown as ExpenseRow);
  }

  async findByInvoiceNumber(projectId: string, invoiceNumber: string): Promise<Expense | null> {
    const rows = await this.db
      .select()
      .from(expensesTable)
      .where(
        and(eq(expensesTable.projectId, projectId), eq(expensesTable.invoiceNumber, invoiceNumber)),
      )
      .limit(1);
    if (!rows[0]) return null;
    return toExpense(rows[0] as unknown as ExpenseRow);
  }

  async findByProject(projectId: string): Promise<Expense[]> {
    const rows = await this.db
      .select()
      .from(expensesTable)
      .where(eq(expensesTable.projectId, projectId))
      .orderBy(desc(expensesTable.transactionDate));
    return rows.map((r) => toExpense(r as unknown as ExpenseRow));
  }

  async createWithAudit(cmd: CreateExpenseWrite): Promise<Expense> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(expensesTable)
        .values({
          id: cmd.id,
          projectId: cmd.projectId,
          organisationId: cmd.organisationId,
          allocationId: cmd.allocationId,
          category: cmd.category,
          description: cmd.description,
          amount: cmd.amount,
          transactionDate: cmd.transactionDate,
          vendorName: cmd.vendorName,
          vendorGstin: cmd.vendorGstin,
          invoiceNumber: cmd.invoiceNumber,
          invoiceDate: cmd.invoiceDate,
          paymentReference: cmd.paymentReference,
          paymentMethod: cmd.paymentMethod,
          status: "draft",
          createdById: cmd.actorUserId,
        })
        .returning();

      const created = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "expense",
        resourceId: created.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: created.id,
        actorUserId: cmd.actorUserId,
        resourceType: "expense",
        resourceId: created.id,
        payload: {
          ...cmd.eventPayload,
          expenseId: created.id,
          projectId: cmd.projectId,
          amount: cmd.amount,
          category: cmd.category,
          status: "draft",
        },
      });

      return toExpense(created as unknown as ExpenseRow);
    });
  }

  async updateWithAudit(cmd: UpdateExpenseWrite): Promise<Expense> {
    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (cmd.category !== undefined) patch.category = cmd.category;
      if (cmd.description !== undefined) patch.description = cmd.description;
      if (cmd.amount !== undefined) patch.amount = cmd.amount;
      if (cmd.transactionDate !== undefined) patch.transactionDate = cmd.transactionDate;
      if (cmd.vendorName !== undefined) patch.vendorName = cmd.vendorName;
      if (cmd.vendorGstin !== undefined) patch.vendorGstin = cmd.vendorGstin;
      if (cmd.invoiceNumber !== undefined) patch.invoiceNumber = cmd.invoiceNumber;
      if (cmd.invoiceDate !== undefined) patch.invoiceDate = cmd.invoiceDate;
      if (cmd.paymentReference !== undefined) patch.paymentReference = cmd.paymentReference;
      if (cmd.paymentMethod !== undefined) patch.paymentMethod = cmd.paymentMethod;

      const rows = await tx
        .update(expensesTable)
        .set(patch)
        .where(eq(expensesTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "expense",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "expense",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          expenseId: updated.id,
          status: updated.status,
          amount: updated.amount,
        },
      });

      return toExpense(updated as unknown as ExpenseRow);
    });
  }

  async transitionStatusWithAudit(cmd: TransitionExpenseWrite): Promise<Expense> {
    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        status: cmd.status,
        updatedAt: new Date(),
      };
      if (cmd.submittedById !== undefined) patch.submittedById = cmd.submittedById;
      if (cmd.submittedAt !== undefined) patch.submittedAt = cmd.submittedAt;
      if (cmd.verifiedById !== undefined) patch.verifiedById = cmd.verifiedById;
      if (cmd.verifiedAt !== undefined) patch.verifiedAt = cmd.verifiedAt;
      if (cmd.voidReason !== undefined) patch.voidReason = cmd.voidReason;
      if (cmd.voidedById !== undefined) patch.voidedById = cmd.voidedById;
      if (cmd.voidedAt !== undefined) patch.voidedAt = cmd.voidedAt;

      const rows = await tx
        .update(expensesTable)
        .set(patch)
        .where(eq(expensesTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "expense",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "expense",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          expenseId: updated.id,
          status: cmd.status,
          voidReason: cmd.voidReason ?? null,
        },
      });

      return toExpense(updated as unknown as ExpenseRow);
    });
  }
}
