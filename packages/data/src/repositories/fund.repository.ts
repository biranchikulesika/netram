import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  fundAllocations as allocationsTable,
  fundReleases as releasesTable,
  expenses as expensesTable,
  projects as projectsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  FundAllocation,
  FundAllocationStatus,
  FundRelease,
  FundReleaseStatus,
  FundSummary,
  AllocationListQuery,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface FundAllocationRow {
  id: string;
  projectId: string;
  programmeId: string | null;
  organisationId: string | null;
  allocatedAmount: string;
  fiscalYear: string;
  currency: string;
  sanctionedById: string | null;
  sanctionedAt: Date | null;
  status: FundAllocationStatus;
  scheme: string | null;
  description: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FundReleaseRow {
  id: string;
  allocationId: string;
  releasedAmount: string;
  releaseDate: Date;
  referenceNumber: string;
  releasedById: string | null;
  remarks: string | null;
  status: FundReleaseStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toFundAllocation(row: FundAllocationRow): FundAllocation {
  return {
    id: row.id,
    projectId: row.projectId,
    programmeId: row.programmeId,
    organisationId: row.organisationId,
    allocatedAmount: row.allocatedAmount,
    fiscalYear: row.fiscalYear,
    currency: row.currency,
    sanctionedById: row.sanctionedById,
    sanctionedAt: row.sanctionedAt ? row.sanctionedAt.toISOString() : null,
    status: row.status,
    scheme: row.scheme,
    description: row.description,
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFundRelease(row: FundReleaseRow): FundRelease {
  return {
    id: row.id,
    allocationId: row.allocationId,
    releasedAmount: row.releasedAmount,
    releaseDate: row.releaseDate.toISOString(),
    referenceNumber: row.referenceNumber,
    releasedById: row.releasedById,
    remarks: row.remarks,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface FundWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateAllocationWrite extends FundWriteContext {
  id?: string;
  projectId: string;
  programmeId?: string | null;
  organisationId?: string | null;
  allocatedAmount: string;
  fiscalYear: string;
  currency?: string;
  sanctionedById?: string | null;
  sanctionedAt?: Date | null;
  scheme?: string | null;
  description?: string | null;
  notes?: string | null;
}

export interface UpdateAllocationWrite extends FundWriteContext {
  id: string;
  allocatedAmount?: string;
  status?: FundAllocationStatus;
  scheme?: string | null;
  description?: string | null;
  notes?: string | null;
}

export interface CreateReleaseWrite extends FundWriteContext {
  id?: string;
  allocationId: string;
  releasedAmount: string;
  releaseDate: Date;
  referenceNumber: string;
  remarks?: string | null;
}

export interface ReverseReleaseWrite extends FundWriteContext {
  id: string;
  remarks?: string | null;
}

export class FundRepository {
  constructor(private db: DrizzleDB) {}

  async listAllocations(
    filter: AllocationListQuery,
    jurisdictionDistrictIds?: string[],
  ): Promise<{ items: FundAllocation[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.projectId) conditions.push(eq(allocationsTable.projectId, filter.projectId));
    if (filter.organisationId)
      conditions.push(eq(allocationsTable.organisationId, filter.organisationId));
    if (filter.fiscalYear) conditions.push(eq(allocationsTable.fiscalYear, filter.fiscalYear));
    if (filter.status) conditions.push(eq(allocationsTable.status, filter.status));

    const where = and(...conditions);
    const joinScope = jurisdictionDistrictIds?.length
      ? inArray(projectsTable.districtId, jurisdictionDistrictIds)
      : undefined;

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    const [rows, count] = await Promise.all([
      this.db
        .select({ allocation: allocationsTable })
        .from(allocationsTable)
        .innerJoin(projectsTable, eq(allocationsTable.projectId, projectsTable.id))
        .where(and(where, joinScope))
        .orderBy(desc(allocationsTable.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(allocationsTable)
        .innerJoin(projectsTable, eq(allocationsTable.projectId, projectsTable.id))
        .where(and(where, joinScope)),
    ]);

    const items = rows.map((r) => toFundAllocation(r.allocation as unknown as FundAllocationRow));
    return { items, total: count[0]?.count ?? 0 };
  }

  async findAllocationById(id: string): Promise<FundAllocation | null> {
    const rows = await this.db
      .select()
      .from(allocationsTable)
      .where(eq(allocationsTable.id, id))
      .limit(1);
    if (!rows[0]) return null;
    return toFundAllocation(rows[0] as unknown as FundAllocationRow);
  }

  async listReleasesByAllocationId(allocationId: string): Promise<FundRelease[]> {
    const rows = await this.db
      .select()
      .from(releasesTable)
      .where(eq(releasesTable.allocationId, allocationId))
      .orderBy(desc(releasesTable.releaseDate));
    return rows.map((r) => toFundRelease(r as unknown as FundReleaseRow));
  }

  async listReleasesByProject(projectId: string): Promise<FundRelease[]> {
    const rows = await this.db
      .select({ release: releasesTable })
      .from(releasesTable)
      .innerJoin(allocationsTable, eq(releasesTable.allocationId, allocationsTable.id))
      .where(eq(allocationsTable.projectId, projectId))
      .orderBy(desc(releasesTable.releaseDate));
    return rows.map((r) => toFundRelease(r.release as unknown as FundReleaseRow));
  }

  async findReleaseById(id: string): Promise<FundRelease | null> {
    const rows = await this.db
      .select()
      .from(releasesTable)
      .where(eq(releasesTable.id, id))
      .limit(1);
    if (!rows[0]) return null;
    return toFundRelease(rows[0] as unknown as FundReleaseRow);
  }

  async findReleaseByReference(referenceNumber: string): Promise<FundRelease | null> {
    const rows = await this.db
      .select()
      .from(releasesTable)
      .where(eq(releasesTable.referenceNumber, referenceNumber))
      .limit(1);
    if (!rows[0]) return null;
    return toFundRelease(rows[0] as unknown as FundReleaseRow);
  }

  async createAllocationWithAudit(cmd: CreateAllocationWrite): Promise<FundAllocation> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(allocationsTable)
        .values({
          id: cmd.id,
          projectId: cmd.projectId,
          programmeId: cmd.programmeId,
          organisationId: cmd.organisationId,
          allocatedAmount: cmd.allocatedAmount,
          fiscalYear: cmd.fiscalYear,
          currency: cmd.currency ?? "INR",
          sanctionedById: cmd.sanctionedById,
          sanctionedAt: cmd.sanctionedAt,
          status: "active",
          scheme: cmd.scheme,
          description: cmd.description,
          notes: cmd.notes,
          createdById: cmd.actorUserId,
        })
        .returning();

      const created = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_allocation",
        resourceId: created.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: created.id,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_allocation",
        resourceId: created.id,
        payload: {
          ...cmd.eventPayload,
          allocationId: created.id,
          projectId: cmd.projectId,
          allocatedAmount: cmd.allocatedAmount,
          fiscalYear: cmd.fiscalYear,
        },
      });

      return toFundAllocation(created as unknown as FundAllocationRow);
    });
  }

  async updateAllocationWithAudit(cmd: UpdateAllocationWrite): Promise<FundAllocation> {
    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (cmd.allocatedAmount !== undefined) patch.allocatedAmount = cmd.allocatedAmount;
      if (cmd.status !== undefined) patch.status = cmd.status;
      if (cmd.scheme !== undefined) patch.scheme = cmd.scheme;
      if (cmd.description !== undefined) patch.description = cmd.description;
      if (cmd.notes !== undefined) patch.notes = cmd.notes;

      const rows = await tx
        .update(allocationsTable)
        .set(patch)
        .where(eq(allocationsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_allocation",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_allocation",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          allocationId: updated.id,
          status: updated.status,
          allocatedAmount: updated.allocatedAmount,
        },
      });

      return toFundAllocation(updated as unknown as FundAllocationRow);
    });
  }

  async createReleaseWithAudit(cmd: CreateReleaseWrite): Promise<FundRelease> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(releasesTable)
        .values({
          id: cmd.id,
          allocationId: cmd.allocationId,
          releasedAmount: cmd.releasedAmount,
          releaseDate: cmd.releaseDate,
          referenceNumber: cmd.referenceNumber,
          releasedById: cmd.actorUserId,
          remarks: cmd.remarks,
          status: "released",
        })
        .returning();

      const created = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_release",
        resourceId: created.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: created.id,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_release",
        resourceId: created.id,
        payload: {
          ...cmd.eventPayload,
          releaseId: created.id,
          allocationId: cmd.allocationId,
          releasedAmount: cmd.releasedAmount,
          referenceNumber: cmd.referenceNumber,
        },
      });

      return toFundRelease(created as unknown as FundReleaseRow);
    });
  }

  async reverseReleaseWithAudit(cmd: ReverseReleaseWrite): Promise<FundRelease> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(releasesTable)
        .set({
          status: "reversed",
          remarks: cmd.remarks,
          updatedAt: new Date(),
        })
        .where(eq(releasesTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_release",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "fund_release",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          releaseId: updated.id,
          status: "reversed",
        },
      });

      return toFundRelease(updated as unknown as FundReleaseRow);
    });
  }

  async getProjectFundSummary(projectId: string): Promise<FundSummary> {
    // 1. Allocations sum and count
    const allocResult = await this.db
      .select({
        totalAllocated: sql<string>`COALESCE(SUM(${allocationsTable.allocatedAmount}), '0.00')::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(allocationsTable)
      .where(and(eq(allocationsTable.projectId, projectId), eq(allocationsTable.status, "active")));

    // 2. Releases sum
    const releaseResult = await this.db
      .select({
        totalReleased: sql<string>`COALESCE(SUM(${releasesTable.releasedAmount}), '0.00')::text`,
      })
      .from(releasesTable)
      .innerJoin(allocationsTable, eq(releasesTable.allocationId, allocationsTable.id))
      .where(and(eq(allocationsTable.projectId, projectId), eq(releasesTable.status, "released")));

    // 3. Expenses sum and counts
    const expenseResult = await this.db
      .select({
        totalExpenditure: sql<string>`COALESCE(SUM(CASE WHEN ${expensesTable.status} IN ('verified', 'submitted', 'under_review') THEN ${expensesTable.amount} ELSE 0 END), '0.00')::text`,
        expensesCount: sql<number>`count(*)::int`,
        flaggedExpensesCount: sql<number>`COALESCE(SUM(CASE WHEN ${expensesTable.status} = 'rejected' THEN 1 ELSE 0 END), 0)::int`,
      })
      .from(expensesTable)
      .where(and(eq(expensesTable.projectId, projectId), sql`${expensesTable.status} != 'voided'`));

    const totalAllocated = allocResult[0]?.totalAllocated ?? "0.00";
    const totalReleased = releaseResult[0]?.totalReleased ?? "0.00";
    const totalExpenditure = expenseResult[0]?.totalExpenditure ?? "0.00";
    const activeAllocationsCount = allocResult[0]?.count ?? 0;
    const expensesCount = expenseResult[0]?.expensesCount ?? 0;
    const flaggedExpensesCount = expenseResult[0]?.flaggedExpensesCount ?? 0;

    const numAllocated = parseFloat(totalAllocated) || 0;
    const numReleased = parseFloat(totalReleased) || 0;
    const numExpenditure = parseFloat(totalExpenditure) || 0;

    const pendingReleases = Math.max(0, numAllocated - numReleased).toFixed(2);
    const utilizationRate =
      numReleased > 0 ? Math.min(100, Math.round((numExpenditure / numReleased) * 10000) / 100) : 0;

    return {
      totalAllocated,
      totalReleased,
      totalExpenditure,
      pendingReleases,
      utilizationRate,
      activeAllocationsCount,
      expensesCount,
      flaggedExpensesCount,
    };
  }
}
