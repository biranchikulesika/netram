import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { outboxEvents } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { OutboxRecord, DomainEventType, UUID } from "@netram/types";

interface OutboxRow {
  id: string;
  type: string;
  correlationId: string;
  occurredAt: Date;
  actorUserId: string | null;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  status: string;
  attemptCount: number;
  availableAfter: Date | null;
  lastError: string | null;
  processedAt: Date | null;
}

function toOutboxRecord(row: OutboxRow): OutboxRecord {
  return {
    id: row.id,
    type: row.type as DomainEventType,
    correlationId: row.correlationId,
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    payload: row.payload ?? {},
    status: row.status as OutboxRecord["status"],
    attemptCount: row.attemptCount,
    availableAfter: row.availableAfter ? row.availableAfter.toISOString() : null,
    lastError: row.lastError,
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
  };
}

export class OutboxRepository {
  constructor(private db: DrizzleDB) {}

  async enqueue(event: {
    id?: UUID;
    type: DomainEventType;
    correlationId: string;
    actorUserId: string | null;
    resourceType: string;
    resourceId: string;
    payload: Record<string, unknown>;
    availableAfter?: Date | null;
  }): Promise<void> {
    await this.db.insert(outboxEvents).values({
      id: event.id,
      type: event.type,
      correlationId: event.correlationId,
      actorUserId: event.actorUserId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      payload: event.payload,
      availableAfter: event.availableAfter ?? null,
    });
  }

  /**
   * Claims a batch of pending outbox records ready for processing.
   * Considers events where availableAfter is null or in the past (§27).
   * Supports optional domain event type filtering to avoid multi-consumer contention.
   */
  async claimPending(limit = 100, types?: readonly string[]): Promise<OutboxRecord[]> {
    const now = new Date();
    const conditions = [
      eq(outboxEvents.status, "pending"),
      or(isNull(outboxEvents.availableAfter), lte(outboxEvents.availableAfter, now)),
    ];
    if (types && types.length > 0) {
      conditions.push(inArray(outboxEvents.type, types as string[]));
    }
    const rows = await this.db
      .select()
      .from(outboxEvents)
      .where(and(...conditions))
      .orderBy(outboxEvents.occurredAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    return rows.map((r) => toOutboxRecord(r as unknown as OutboxRow));
  }

  /** Returns the durable event history for a resource, newest first — used by `/inspections/:id/events`. */
  async listByResource(
    resourceType: string,
    resourceId: string,
    limit = 200,
  ): Promise<OutboxRecord[]> {
    const rows = await this.db
      .select()
      .from(outboxEvents)
      .where(
        and(eq(outboxEvents.resourceType, resourceType), eq(outboxEvents.resourceId, resourceId)),
      )
      .orderBy(desc(outboxEvents.occurredAt))
      .limit(limit);
    return rows.map((r) => toOutboxRecord(r as unknown as OutboxRow));
  }

  async markProcessed(id: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(outboxEvents.id, id));
  }

  /**
   * Schedules a retry for an outbox event with exponential backoff (§27).
   */
  async scheduleRetry(id: string, error: string, backoffMs: number): Promise<void> {
    const nextAvailable = new Date(Date.now() + backoffMs);
    await this.db
      .update(outboxEvents)
      .set({
        status: "pending",
        availableAfter: nextAvailable,
        lastError: error.slice(0, 500),
        attemptCount: sql`${outboxEvents.attemptCount} + 1`,
      })
      .where(eq(outboxEvents.id, id));
  }

  /**
   * Marks an outbox event permanently failed / dead-lettered after exhausting retries (§27).
   */
  async markDeadLetter(id: string, error: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        status: "failed",
        lastError: `DEAD_LETTER: ${error.slice(0, 480)}`,
        attemptCount: sql`${outboxEvents.attemptCount} + 1`,
      })
      .where(eq(outboxEvents.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        status: "failed",
        lastError: error.slice(0, 500),
        attemptCount: sql`${outboxEvents.attemptCount} + 1`,
      })
      .where(eq(outboxEvents.id, id));
  }
}
