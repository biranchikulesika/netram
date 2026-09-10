import { and, desc, eq, sql } from "drizzle-orm";
import { auditEvents } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { AuditAction, AuditEvent, AuditListQuery } from "@netram/types";

export interface AuditAppend {
  action: AuditAction;
  actorUserId: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AuditRepository {
  constructor(private db: DrizzleDB) {}

  async append(entry: AuditAppend): Promise<void> {
    await this.db.insert(auditEvents).values({
      action: entry.action,
      actorUserId: entry.actorUserId,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      requestId: entry.requestId ?? null,
      ipAddress: entry.ipAddress ?? null,
      metadata: entry.metadata ?? null,
    });
  }

  async list(
    filter: Required<Pick<AuditListQuery, "page" | "pageSize">> & AuditListQuery,
  ): Promise<{ items: AuditEvent[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.action) conditions.push(eq(auditEvents.action, filter.action));
    if (filter.resourceType) conditions.push(eq(auditEvents.resourceType, filter.resourceType));
    if (filter.resourceId) conditions.push(eq(auditEvents.resourceId, filter.resourceId));
    if (filter.actorUserId) conditions.push(eq(auditEvents.actorUserId, filter.actorUserId));
    const where = and(...conditions);

    const [rows, count] = await Promise.all([
      this.db
        .select()
        .from(auditEvents)
        .where(where)
        .orderBy(desc(auditEvents.occurredAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditEvents)
        .where(where),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      action: r.action as AuditAction,
      actorUserId: r.actorUserId,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      requestId: r.requestId,
      ipAddress: r.ipAddress,
      metadata: r.metadata as Record<string, unknown> | null,
      occurredAt: r.occurredAt.toISOString(),
    }));
    return { items, total: count[0]?.count ?? 0 };
  }
}
