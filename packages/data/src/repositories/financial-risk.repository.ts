import { desc, eq } from "drizzle-orm";
import {
  financialRiskRules as rulesTable,
  financialRiskEvents as riskEventsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  FinancialRiskRule,
  FinancialRiskEvent,
  FinancialRiskSeverity,
  FinancialRiskEventStatus,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface FinancialRiskRuleRow {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  conditionConfig: Record<string, unknown>;
  weight: number;
  severity: FinancialRiskSeverity;
  enabled: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialRiskEventRow {
  id: string;
  ruleId: string;
  projectId: string;
  organisationId: string | null;
  expenseId: string | null;
  documentId: string | null;
  allocationId: string | null;
  scoreContribution: number;
  detail: Record<string, unknown>;
  status: FinancialRiskEventStatus;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export function toFinancialRiskRule(row: FinancialRiskRuleRow): FinancialRiskRule {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    conditionConfig: row.conditionConfig ?? {},
    weight: row.weight,
    severity: row.severity,
    enabled: row.enabled,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFinancialRiskEvent(row: FinancialRiskEventRow): FinancialRiskEvent {
  return {
    id: row.id,
    ruleId: row.ruleId,
    projectId: row.projectId,
    organisationId: row.organisationId,
    expenseId: row.expenseId,
    documentId: row.documentId,
    allocationId: row.allocationId,
    scoreContribution: row.scoreContribution,
    detail: row.detail ?? {},
    status: row.status,
    resolvedById: row.resolvedById,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface CreateRiskRuleCmd {
  id?: string;
  code: string;
  name: string;
  category: string;
  description: string;
  conditionConfig?: Record<string, unknown>;
  weight: number;
  severity: FinancialRiskSeverity;
  enabled?: boolean;
  actorUserId: string | null;
}

export interface UpdateRiskRuleCmd {
  id: string;
  name?: string;
  category?: string;
  description?: string;
  conditionConfig?: Record<string, unknown>;
  weight?: number;
  severity?: FinancialRiskSeverity;
  enabled?: boolean;
  actorUserId: string | null;
}

export interface CreateRiskEventItem {
  id?: string;
  ruleId: string;
  projectId: string;
  organisationId?: string | null;
  expenseId?: string | null;
  documentId?: string | null;
  allocationId?: string | null;
  scoreContribution: number;
  detail: Record<string, unknown>;
}

export interface ResolveRiskEventCmd {
  id: string;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export class FinancialRiskRepository {
  constructor(private db: DrizzleDB) {}

  async listRules(enabledOnly: boolean = false): Promise<FinancialRiskRule[]> {
    let query = this.db.select().from(rulesTable);
    if (enabledOnly) {
      // @ts-expect-error drizzle where condition
      query = query.where(eq(rulesTable.enabled, true));
    }
    const rows = await query.orderBy(rulesTable.code);
    return rows.map((r) => toFinancialRiskRule(r as unknown as FinancialRiskRuleRow));
  }

  async findRuleByCode(code: string): Promise<FinancialRiskRule | null> {
    const rows = await this.db.select().from(rulesTable).where(eq(rulesTable.code, code)).limit(1);
    if (!rows[0]) return null;
    return toFinancialRiskRule(rows[0] as unknown as FinancialRiskRuleRow);
  }

  async findRuleById(id: string): Promise<FinancialRiskRule | null> {
    const rows = await this.db.select().from(rulesTable).where(eq(rulesTable.id, id)).limit(1);
    if (!rows[0]) return null;
    return toFinancialRiskRule(rows[0] as unknown as FinancialRiskRuleRow);
  }

  async createRule(cmd: CreateRiskRuleCmd): Promise<FinancialRiskRule> {
    const rows = await this.db
      .insert(rulesTable)
      .values({
        id: cmd.id,
        code: cmd.code,
        name: cmd.name,
        category: cmd.category,
        description: cmd.description,
        conditionConfig: cmd.conditionConfig ?? {},
        weight: cmd.weight,
        severity: cmd.severity,
        enabled: cmd.enabled ?? true,
        createdById: cmd.actorUserId,
      })
      .returning();
    return toFinancialRiskRule(rows[0] as unknown as FinancialRiskRuleRow);
  }

  async updateRule(cmd: UpdateRiskRuleCmd): Promise<FinancialRiskRule> {
    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (cmd.name !== undefined) patch.name = cmd.name;
    if (cmd.category !== undefined) patch.category = cmd.category;
    if (cmd.description !== undefined) patch.description = cmd.description;
    if (cmd.conditionConfig !== undefined) patch.conditionConfig = cmd.conditionConfig;
    if (cmd.weight !== undefined) patch.weight = cmd.weight;
    if (cmd.severity !== undefined) patch.severity = cmd.severity;
    if (cmd.enabled !== undefined) patch.enabled = cmd.enabled;
    if (cmd.actorUserId !== undefined) patch.updatedById = cmd.actorUserId;

    const rows = await this.db
      .update(rulesTable)
      .set(patch)
      .where(eq(rulesTable.id, cmd.id))
      .returning();
    return toFinancialRiskRule(rows[0] as unknown as FinancialRiskRuleRow);
  }

  async createRiskEvents(events: CreateRiskEventItem[]): Promise<FinancialRiskEvent[]> {
    if (events.length === 0) return [];

    return this.db.transaction(async (tx) => {
      const insertedRows = await tx
        .insert(riskEventsTable)
        .values(
          events.map((e) => ({
            id: e.id,
            ruleId: e.ruleId,
            projectId: e.projectId,
            organisationId: e.organisationId,
            expenseId: e.expenseId,
            documentId: e.documentId,
            allocationId: e.allocationId,
            scoreContribution: e.scoreContribution,
            detail: e.detail,
            status: "open",
          })),
        )
        .returning();

      // Emit outbox events for high/critical anomalies
      for (const row of insertedRows) {
        if (row.scoreContribution >= 15) {
          await tx.insert(outboxEvents).values({
            type: "financial_risk.anomaly_detected",
            correlationId: row.id,
            resourceType: "financial_risk_event",
            resourceId: row.id,
            payload: {
              eventId: row.id,
              ruleId: row.ruleId,
              projectId: row.projectId,
              scoreContribution: row.scoreContribution,
            },
          });
        }
      }

      return insertedRows.map((r) => toFinancialRiskEvent(r as unknown as FinancialRiskEventRow));
    });
  }

  async listEventsByProject(projectId: string): Promise<FinancialRiskEvent[]> {
    const rows = await this.db
      .select()
      .from(riskEventsTable)
      .where(eq(riskEventsTable.projectId, projectId))
      .orderBy(desc(riskEventsTable.createdAt));
    return rows.map((r) => toFinancialRiskEvent(r as unknown as FinancialRiskEventRow));
  }

  async resolveEventWithAudit(cmd: ResolveRiskEventCmd): Promise<FinancialRiskEvent> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(riskEventsTable)
        .set({
          status: "resolved",
          resolvedById: cmd.actorUserId,
          resolvedAt: new Date(),
        })
        .where(eq(riskEventsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "financial_risk_event",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "financial_risk_event",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          eventId: updated.id,
          status: "resolved",
        },
      });

      return toFinancialRiskEvent(updated as unknown as FinancialRiskEventRow);
    });
  }
}
