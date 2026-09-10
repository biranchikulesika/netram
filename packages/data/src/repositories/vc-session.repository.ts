import { and, desc, eq, sql } from "drizzle-orm";
import {
  vcSessions as vcSessionsTable,
  vcParticipants as vcParticipantsTable,
  projects,
  users,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  VcSession,
  VcParticipant,
  VcSessionWithParticipants,
  VcSessionStatus,
  VcParticipantRole,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface VcWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface VcSessionListFilter {
  inspectionId?: string;
  projectId?: string;
  status?: VcSessionStatus;
  page: number;
  pageSize: number;
}

export function toVcSession(row: typeof vcSessionsTable.$inferSelect): VcSession {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    projectId: row.projectId,
    title: row.title,
    status: row.status as VcSessionStatus,
    hostUserId: row.hostUserId,
    roomName: row.roomName,
    provider: row.provider,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVcParticipant(row: typeof vcParticipantsTable.$inferSelect): VcParticipant {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    role: row.role as VcParticipantRole,
    joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
    leftAt: row.leftAt ? row.leftAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class VcSessionRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: string): Promise<VcSessionWithParticipants | null> {
    const sessionRows = await this.db
      .select({
        session: vcSessionsTable,
        projectName: projects.name,
        hostEmail: users.email,
      })
      .from(vcSessionsTable)
      .leftJoin(projects, eq(vcSessionsTable.projectId, projects.id))
      .leftJoin(users, eq(vcSessionsTable.hostUserId, users.id))
      .where(eq(vcSessionsTable.id, id))
      .limit(1);

    const match = sessionRows[0];
    if (!match) return null;

    const participantRows = await this.db
      .select()
      .from(vcParticipantsTable)
      .where(eq(vcParticipantsTable.sessionId, id));

    return {
      ...toVcSession(match.session),
      projectName: match.projectName,
      hostEmail: match.hostEmail,
      participants: participantRows.map(toVcParticipant),
    };
  }

  async list(
    filter: VcSessionListFilter,
  ): Promise<{ items: VcSessionWithParticipants[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.inspectionId) conditions.push(eq(vcSessionsTable.inspectionId, filter.inspectionId));
    if (filter.projectId) conditions.push(eq(vcSessionsTable.projectId, filter.projectId));
    if (filter.status) conditions.push(eq(vcSessionsTable.status, filter.status));

    const where = conditions.length ? and(...conditions) : undefined;

    const [sessionRows, count] = await Promise.all([
      this.db
        .select({
          session: vcSessionsTable,
          projectName: projects.name,
          hostEmail: users.email,
        })
        .from(vcSessionsTable)
        .leftJoin(projects, eq(vcSessionsTable.projectId, projects.id))
        .leftJoin(users, eq(vcSessionsTable.hostUserId, users.id))
        .where(where)
        .orderBy(desc(vcSessionsTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(vcSessionsTable)
        .where(where),
    ]);

    const sessionIds = sessionRows.map((r) => r.session.id);
    let allParticipants: (typeof vcParticipantsTable.$inferSelect)[] = [];
    if (sessionIds.length > 0) {
      allParticipants = await this.db.select().from(vcParticipantsTable);
    }

    const items: VcSessionWithParticipants[] = sessionRows.map((r) => {
      const parts = allParticipants.filter((p) => p.sessionId === r.session.id);
      return {
        ...toVcSession(r.session),
        projectName: r.projectName,
        hostEmail: r.hostEmail,
        participants: parts.map(toVcParticipant),
      };
    });

    return {
      items,
      total: count[0]?.count ?? 0,
    };
  }

  async create(
    input: {
      id?: string;
      title: string;
      inspectionId?: string | null;
      projectId?: string | null;
      hostUserId: string;
      roomName: string;
      provider: string;
      scheduledAt?: Date | null;
      metadata?: Record<string, unknown> | null;
      participants?: Array<{ userId: string; role: VcParticipantRole }>;
    },
    context: VcWriteContext,
  ): Promise<VcSessionWithParticipants> {
    return this.db.transaction(async (tx) => {
      const [sessionRow] = await tx
        .insert(vcSessionsTable)
        .values({
          id: input.id,
          title: input.title,
          inspectionId: input.inspectionId,
          projectId: input.projectId,
          hostUserId: input.hostUserId,
          roomName: input.roomName,
          provider: input.provider,
          status: "scheduled",
          scheduledAt: input.scheduledAt,
          metadata: input.metadata,
        })
        .returning();

      if (!sessionRow) {
        throw new Error("Failed to insert VC session record");
      }

      // Add host as a participant automatically
      const participantValues: Array<{
        sessionId: string;
        userId: string;
        role: VcParticipantRole;
      }> = [{ sessionId: sessionRow.id, userId: input.hostUserId, role: "host" }];

      if (input.participants) {
        for (const p of input.participants) {
          if (p.userId !== input.hostUserId) {
            participantValues.push({
              sessionId: sessionRow.id,
              userId: p.userId,
              role: p.role,
            });
          }
        }
      }

      const insertedParticipants = await tx
        .insert(vcParticipantsTable)
        .values(participantValues)
        .returning();

      await tx.insert(auditEvents).values({
        action: context.auditAction,
        actorUserId: context.actorUserId,
        resourceType: "vc_session",
        resourceId: sessionRow.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        metadata: {
          ...context.auditMetadata,
          sessionId: sessionRow.id,
          roomName: input.roomName,
          title: input.title,
        },
      });

      await tx.insert(outboxEvents).values({
        type: context.eventType,
        correlationId: sessionRow.id,
        actorUserId: context.actorUserId,
        resourceType: "vc_session",
        resourceId: sessionRow.id,
        payload: {
          ...context.eventPayload,
          sessionId: sessionRow.id,
          roomName: input.roomName,
          title: input.title,
          inspectionId: input.inspectionId,
        },
      });

      return {
        ...toVcSession(sessionRow),
        participants: insertedParticipants.map(toVcParticipant),
      };
    });
  }

  async updateStatus(
    id: string,
    status: VcSessionStatus,
    timestamps: { startedAt?: Date; endedAt?: Date },
    context: VcWriteContext,
  ): Promise<VcSessionWithParticipants> {
    return this.db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };
      if (timestamps.startedAt !== undefined) updateData.startedAt = timestamps.startedAt;
      if (timestamps.endedAt !== undefined) updateData.endedAt = timestamps.endedAt;

      const [updated] = await tx
        .update(vcSessionsTable)
        .set(updateData)
        .where(eq(vcSessionsTable.id, id))
        .returning();

      if (!updated) {
        throw new Error(`VC session ${id} not found`);
      }

      const participantRows = await tx
        .select()
        .from(vcParticipantsTable)
        .where(eq(vcParticipantsTable.sessionId, id));

      await tx.insert(auditEvents).values({
        action: context.auditAction,
        actorUserId: context.actorUserId,
        resourceType: "vc_session",
        resourceId: id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        metadata: {
          ...context.auditMetadata,
          sessionId: id,
          newStatus: status,
        },
      });

      await tx.insert(outboxEvents).values({
        type: context.eventType,
        correlationId: id,
        actorUserId: context.actorUserId,
        resourceType: "vc_session",
        resourceId: id,
        payload: {
          ...context.eventPayload,
          sessionId: id,
          newStatus: status,
          roomName: updated.roomName,
          inspectionId: updated.inspectionId,
        },
      });

      return {
        ...toVcSession(updated),
        participants: participantRows.map(toVcParticipant),
      };
    });
  }

  async recordParticipantJoin(
    sessionId: string,
    userId: string,
    role: VcParticipantRole,
    context?: VcWriteContext,
  ): Promise<VcParticipant> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(vcParticipantsTable)
        .where(
          and(eq(vcParticipantsTable.sessionId, sessionId), eq(vcParticipantsTable.userId, userId)),
        )
        .limit(1);

      let record: typeof vcParticipantsTable.$inferSelect;
      if (existing[0]) {
        const [updated] = await tx
          .update(vcParticipantsTable)
          .set({ joinedAt: new Date(), role })
          .where(eq(vcParticipantsTable.id, existing[0].id))
          .returning();
        record = updated!;
      } else {
        const [created] = await tx
          .insert(vcParticipantsTable)
          .values({
            sessionId,
            userId,
            role,
            joinedAt: new Date(),
          })
          .returning();
        record = created!;
      }

      if (context) {
        await tx.insert(auditEvents).values({
          action: context.auditAction,
          actorUserId: context.actorUserId,
          resourceType: "vc_session",
          resourceId: sessionId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          metadata: {
            ...context.auditMetadata,
            sessionId,
            userId,
            role,
          },
        });

        await tx.insert(outboxEvents).values({
          type: context.eventType,
          correlationId: sessionId,
          actorUserId: context.actorUserId,
          resourceType: "vc_session",
          resourceId: sessionId,
          payload: {
            ...context.eventPayload,
            sessionId,
            userId,
            role,
          },
        });
      }

      return toVcParticipant(record);
    });
  }

  async recordParticipantLeave(
    sessionId: string,
    userId: string,
    context?: VcWriteContext,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(vcParticipantsTable)
        .set({ leftAt: new Date() })
        .where(
          and(eq(vcParticipantsTable.sessionId, sessionId), eq(vcParticipantsTable.userId, userId)),
        );

      if (context) {
        await tx.insert(auditEvents).values({
          action: context.auditAction,
          actorUserId: context.actorUserId,
          resourceType: "vc_session",
          resourceId: sessionId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          metadata: {
            ...context.auditMetadata,
            sessionId,
            userId,
          },
        });

        await tx.insert(outboxEvents).values({
          type: context.eventType,
          correlationId: sessionId,
          actorUserId: context.actorUserId,
          resourceType: "vc_session",
          resourceId: sessionId,
          payload: {
            ...context.eventPayload,
            sessionId,
            userId,
          },
        });
      }
    });
  }
}
