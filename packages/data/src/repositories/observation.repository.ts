import { desc, eq } from "drizzle-orm";
import { observations as observationsTable, auditEvents, outboxEvents } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { AuditAction, DomainEventType, Observation } from "@netram/types";

export interface ObservationRow {
  id: string;
  inspectionId: string;
  userId: string;
  text: string;
  createdAt: Date;
}

export function toObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    userId: row.userId,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ObservationWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateObservationWrite extends ObservationWriteContext {
  id: string;
  inspectionId: string;
  userId: string;
  text: string;
}

/**
 * Persistence for inspector observations. Each record plus audit and outbox
 * publication intent is atomic.
 */
export class ObservationRepository {
  constructor(private db: DrizzleDB) {}

  async listByInspection(inspectionId: string): Promise<Observation[]> {
    const rows = await this.db
      .select()
      .from(observationsTable)
      .where(eq(observationsTable.inspectionId, inspectionId))
      .orderBy(desc(observationsTable.createdAt));
    return rows.map((r) => toObservation(r as unknown as ObservationRow));
  }

  async createWithAuditAndEvent(cmd: CreateObservationWrite): Promise<Observation> {
    const created: Observation = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(observationsTable)
        .values({
          id: cmd.id,
          inspectionId: cmd.inspectionId,
          userId: cmd.userId,
          text: cmd.text,
        })
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "observation",
        resourceId: cmd.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata, inspectionId: cmd.inspectionId },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.id,
        actorUserId: cmd.actorUserId,
        resourceType: "observation",
        resourceId: cmd.id,
        payload: {
          ...cmd.eventPayload,
          observationId: cmd.id,
          inspectionId: cmd.inspectionId,
        },
      });

      return toObservation(row as unknown as ObservationRow);
    });
    return created;
  }
}
