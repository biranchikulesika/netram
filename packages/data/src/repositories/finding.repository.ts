import { desc, eq } from "drizzle-orm";
import { findings as findingsTable, auditEvents, outboxEvents } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import { RepositoryNotFoundError } from "./errors.js";
import type {
  AuditAction,
  DomainEventType,
  Finding,
  FindingSeverity,
  FindingStatus,
} from "@netram/types";

export interface FindingRow {
  id: string;
  inspectionId: string;
  observationId: string | null;
  severity: FindingSeverity;
  description: string;
  remediation: string | null;
  status: FindingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    observationId: row.observationId,
    severity: row.severity,
    description: row.description,
    remediation: row.remediation,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface FindingWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateFindingWrite extends FindingWriteContext {
  id: string;
  inspectionId: string;
  observationId: string | null;
  severity: FindingSeverity;
  description: string;
  remediation: string | null;
}

export interface TransitionFindingWrite extends FindingWriteContext {
  findingId: string;
  to: FindingStatus;
  note: string | null;
}

/**
 * Persistence for findings. All mutations plus audit and outbox are atomic.
 */
export class FindingRepository {
  constructor(private db: DrizzleDB) {}

  async listByInspection(inspectionId: string): Promise<Finding[]> {
    const rows = await this.db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.inspectionId, inspectionId))
      .orderBy(desc(findingsTable.createdAt));
    return rows.map((r) => toFinding(r as unknown as FindingRow));
  }

  async findById(id: string): Promise<Finding | null> {
    const rows = await this.db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return toFinding(rows[0] as unknown as FindingRow);
  }

  async createWithAuditAndEvent(cmd: CreateFindingWrite): Promise<Finding> {
    const created: Finding = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(findingsTable)
        .values({
          id: cmd.id,
          inspectionId: cmd.inspectionId,
          observationId: cmd.observationId,
          severity: cmd.severity,
          description: cmd.description,
          remediation: cmd.remediation,
          status: "new",
        })
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: {
          ...cmd.auditMetadata,
          inspectionId: cmd.inspectionId,
          severity: cmd.severity,
        },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.id,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.id,
        payload: {
          ...cmd.eventPayload,
          findingId: cmd.id,
          inspectionId: cmd.inspectionId,
          status: "new",
        },
      });

      return toFinding(row as unknown as FindingRow);
    });
    return created;
  }

  async transitionWithAuditAndEvent(cmd: TransitionFindingWrite): Promise<Finding> {
    const current = await this.findById(cmd.findingId);
    if (!current) throw new RepositoryNotFoundError("Finding");

    const transitioned: Finding = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(findingsTable)
        .set({ status: cmd.to, updatedAt: new Date() })
        .where(eq(findingsTable.id, cmd.findingId))
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.findingId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: {
          ...cmd.auditMetadata,
          from: current.status,
          to: cmd.to,
          note: cmd.note ?? null,
        },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.findingId,
        actorUserId: cmd.actorUserId,
        resourceType: "finding",
        resourceId: cmd.findingId,
        payload: {
          ...cmd.eventPayload,
          findingId: cmd.findingId,
          from: current.status,
          to: cmd.to,
        },
      });

      return toFinding(row as unknown as FindingRow);
    });
    return transitioned;
  }
}
