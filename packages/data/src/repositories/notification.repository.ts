import { and, count, desc, eq } from "drizzle-orm";
import { notifications as notificationsTable } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { Notification, NotificationStatus, NotificationType } from "@netram/types";

export interface CreateNotificationWrite {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
}

export function toNotification(row: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  status: string;
  createdAt: Date;
}): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    status: row.status as NotificationStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export class NotificationRepository {
  constructor(private db: DrizzleDB) {}

  async listByUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Notification[]; total: number; unread: number }> {
    const [rows, total, unread] = await Promise.all([
      this.db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId)),
      this.db
        .select({ count: count() })
        .from(notificationsTable)
        .where(
          and(eq(notificationsTable.userId, userId), eq(notificationsTable.status, "pending")),
        ),
    ]);
    return {
      items: rows.map((r) => toNotification(r)),
      total: total[0]?.count ?? 0,
      unread: unread[0]?.count ?? 0,
    };
  }

  async findById(id: string): Promise<Notification | null> {
    const rows = await this.db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id))
      .limit(1);
    if (!rows[0]) return null;
    return toNotification(rows[0]);
  }

  async markRead(userId: string, id: string): Promise<Notification | null> {
    const rows = await this.db
      .update(notificationsTable)
      .set({ status: "read" })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
      .returning();
    if (!rows[0]) return null;
    return toNotification(rows[0]);
  }

  async markAllRead(userId: string): Promise<number> {
    const rows = await this.db
      .update(notificationsTable)
      .set({ status: "read" })
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.status, "pending")))
      .returning({ id: notificationsTable.id });
    return rows.length;
  }

  async create(cmd: CreateNotificationWrite): Promise<Notification> {
    const rows = await this.db
      .insert(notificationsTable)
      .values({
        ...(cmd.id ? { id: cmd.id } : {}),
        userId: cmd.userId,
        type: cmd.type,
        title: cmd.title,
        body: cmd.body ?? null,
        status: "pending",
      })
      .returning();
    return toNotification(rows[0]!);
  }
}
