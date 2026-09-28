import { desc, eq, and, sql } from "drizzle-orm";
import {
  callContacts as callContactsTable,
  callRecords as callRecordsTable,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  CallContact,
  CallRecord,
  CreateCallRecordInput,
  CallRole,
  CallDirection,
  CallStatus,
  CallCondition,
} from "@netram/types";

export function toCallContact(row: typeof callContactsTable.$inferSelect): CallContact {
  return {
    id: row.id,
    name: row.name,
    role: row.role as CallRole,
    title: row.title,
    projectId: row.projectId,
    projectCode: row.projectCode,
    projectName: row.projectName,
    phone: row.phone,
    isOnline: row.isOnline,
    avatarColor: row.avatarColor,
    videoUri: row.videoUri,
  };
}

export function toCallRecord(row: typeof callRecordsTable.$inferSelect): CallRecord {
  return {
    id: row.id,
    contactId: row.contactId,
    contactName: row.contactName,
    contactTitle: row.contactTitle,
    role: row.role as CallRole,
    projectId: row.projectId,
    projectCode: row.projectCode,
    projectName: row.projectName,
    callType: "video",
    durationSeconds: row.durationSeconds,
    timestamp: row.startedAt
      ? row.startedAt.toISOString()
      : row.createdAt.toISOString(),
    condition: row.condition as CallCondition,
    reviewText: row.reviewText,
    flagInspection: row.flagInspection,
    videoUri: row.videoUri,
    inspectorVideoUri: row.inspectorVideoUri,
    direction: row.direction as CallDirection,
    status: row.status as CallStatus,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class CallRepository {
  constructor(private db: DrizzleDB) {}

  async listContacts(): Promise<CallContact[]> {
    const rows = await this.db
      .select()
      .from(callContactsTable)
      .orderBy(callContactsTable.name);
    return rows.map(toCallContact);
  }

  async getContactById(id: string): Promise<CallContact | null> {
    const rows = await this.db
      .select()
      .from(callContactsTable)
      .where(eq(callContactsTable.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toCallContact(row) : null;
  }

  async listCallHistory(filter?: {
    contactId?: string;
    direction?: CallDirection;
    status?: CallStatus;
    limit?: number;
  }): Promise<CallRecord[]> {
    const conditions = [];
    if (filter?.contactId) conditions.push(eq(callRecordsTable.contactId, filter.contactId));
    if (filter?.direction) conditions.push(eq(callRecordsTable.direction, filter.direction));
    if (filter?.status) conditions.push(eq(callRecordsTable.status, filter.status));

    const where = conditions.length ? and(...conditions) : undefined;
    const limit = filter?.limit ?? 50;

    const rows = await this.db
      .select()
      .from(callRecordsTable)
      .where(where)
      .orderBy(desc(callRecordsTable.createdAt))
      .limit(limit);

    return rows.map(toCallRecord);
  }

  async createCallRecord(input: CreateCallRecordInput): Promise<CallRecord> {
    const recordId = input.id ?? `call-${Date.now()}`;
    const [inserted] = await this.db
      .insert(callRecordsTable)
      .values({
        id: recordId,
        contactId: input.contactId,
        contactName: input.contactName,
        contactTitle: input.contactTitle,
        role: input.role,
        projectId: input.projectId,
        projectCode: input.projectCode,
        projectName: input.projectName,
        callType: "video",
        durationSeconds: input.durationSeconds ?? 0,
        direction: input.direction ?? "outgoing",
        status: input.status ?? (input.durationSeconds > 0 ? "answered" : "missed"),
        condition: input.condition ?? "satisfactory",
        reviewText: input.reviewText,
        flagInspection: input.flagInspection ?? false,
        videoUri: input.videoUri,
        inspectorVideoUri: input.inspectorVideoUri,
        startedAt: input.timestamp ? new Date(input.timestamp) : new Date(),
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert call record");
    }

    return toCallRecord(inserted);
  }

  async countContacts(): Promise<number> {
    const res = await this.db.select({ count: sql<number>`count(*)::int` }).from(callContactsTable);
    return res[0]?.count ?? 0;
  }

  async countHistory(): Promise<number> {
    const res = await this.db.select({ count: sql<number>`count(*)::int` }).from(callRecordsTable);
    return res[0]?.count ?? 0;
  }
}
