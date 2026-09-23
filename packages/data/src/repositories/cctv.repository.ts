import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  cctvCameras as cctvCamerasTable,
  cctvStreams as cctvStreamsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  CctvCamera,
  CctvStreamSession,
  CameraStatus,
  StreamSessionStatus,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface CctvCameraRow {
  id: string;
  name: string;
  provider: string;
  protocol: string;
  endpoint: string;
  districtId: string | null;
  projectId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toCctvCamera(row: CctvCameraRow): CctvCamera {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    protocol: row.protocol,
    endpoint: row.endpoint,
    districtId: row.districtId,
    projectId: row.projectId,
    status: row.status as CameraStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCctvStreamSession(row: typeof cctvStreamsTable.$inferSelect): CctvStreamSession {
  return {
    id: row.id,
    cameraId: row.cameraId,
    sessionId: row.sessionId ?? "",
    status: row.status as StreamSessionStatus,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface CctvWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CctvCameraListFilter {
  districtId?: string;
  status?: CameraStatus;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

/**
 * Persistence for CCTV cameras and streaming sessions (AGENTS.md §42).
 * Raw camera endpoints are stored here and exposed ONLY to the internal gateway.
 * Client sessions, audit records, and outbox events are written atomically.
 */
export class CctvRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: string): Promise<CctvCamera | null> {
    const rows = await this.db
      .select()
      .from(cctvCamerasTable)
      .where(eq(cctvCamerasTable.id, id))
      .limit(1);
    if (!rows[0]) return null;
    return toCctvCamera(rows[0]);
  }

  async list(filter: CctvCameraListFilter): Promise<{ items: CctvCamera[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.status) conditions.push(eq(cctvCamerasTable.status, filter.status));
    if (filter.districtId) conditions.push(eq(cctvCamerasTable.districtId, filter.districtId));

    const where = and(...conditions);
    const scope = filter.jurisdictionIds?.length
      ? inArray(cctvCamerasTable.districtId, filter.jurisdictionIds)
      : undefined;
    const scoped = and(where, scope);

    const [rows, count] = await Promise.all([
      this.db
        .select()
        .from(cctvCamerasTable)
        .where(scoped)
        .orderBy(desc(cctvCamerasTable.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cctvCamerasTable)
        .where(scoped),
    ]);

    return {
      items: rows.map(toCctvCamera),
      total: count[0]?.count ?? 0,
    };
  }

  async createStreamSession(
    input: { id?: string; cameraId: string; sessionId: string },
    context: CctvWriteContext,
  ): Promise<CctvStreamSession> {
    return this.db.transaction(async (tx) => {
      const [streamRow] = await tx
        .insert(cctvStreamsTable)
        .values({
          id: input.id,
          cameraId: input.cameraId,
          sessionId: input.sessionId,
          status: "active",
        })
        .returning();

      if (!streamRow) {
        throw new Error("Failed to create CCTV stream session record");
      }

      await tx.insert(auditEvents).values({
        action: context.auditAction,
        actorUserId: context.actorUserId,
        resourceType: "cctv_camera",
        resourceId: input.cameraId,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        metadata: {
          ...context.auditMetadata,
          streamSessionId: streamRow.id,
          sessionId: input.sessionId,
        },
      });

      await tx.insert(outboxEvents).values({
        type: context.eventType,
        correlationId: streamRow.id,
        actorUserId: context.actorUserId,
        resourceType: "cctv_camera",
        resourceId: input.cameraId,
        payload: {
          ...context.eventPayload,
          streamSessionId: streamRow.id,
          cameraId: input.cameraId,
        },
      });

      return toCctvStreamSession(streamRow);
    });
  }

  async endStreamSession(sessionId: string, context: CctvWriteContext): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(cctvStreamsTable)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(eq(cctvStreamsTable.sessionId, sessionId))
        .returning();

      const ended = rows[0];
      if (!ended) return;

      await tx.insert(auditEvents).values({
        action: context.auditAction,
        actorUserId: context.actorUserId,
        resourceType: "cctv_camera",
        resourceId: ended.cameraId,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        metadata: {
          ...context.auditMetadata,
          streamSessionId: ended.id,
          sessionId,
        },
      });

      await tx.insert(outboxEvents).values({
        type: context.eventType,
        correlationId: ended.id,
        actorUserId: context.actorUserId,
        resourceType: "cctv_camera",
        resourceId: ended.cameraId,
        payload: {
          ...context.eventPayload,
          streamSessionId: ended.id,
          cameraId: ended.cameraId,
        },
      });
    });
  }
}
