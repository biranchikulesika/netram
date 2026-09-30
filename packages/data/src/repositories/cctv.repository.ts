import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
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
  StreamEndReason,
  StreamEndedBy,
  AuditAction,
  DomainEventType,
} from "@netram/types";

/**
 * Hash a playback token for persistence (§22 - plaintext bearer material is
 * never stored). The external auth hook presents the token; the API compares
 * its SHA-256 against this column.
 */
export function hashStreamToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface EndStreamInput {
  endedBy: StreamEndedBy;
  endReason: StreamEndReason;
}

/** Sessions the sweeper should end: expired token OR heartbeat too old. */
export interface SweepCandidate {
  id: string;
  sessionId: string | null;
  cameraId: string;
  mediaPath: string | null;
  reason: StreamEndReason;
}

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
    mediaPath: row.mediaPath ?? null,
    lastHeartbeatAt: row.lastHeartbeatAt ? row.lastHeartbeatAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    endedBy: (row.endedBy ?? null) as CctvStreamSession["endedBy"],
    endReason: (row.endReason ?? null) as CctvStreamSession["endReason"],
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
    input: {
      id?: string;
      cameraId: string;
      sessionId: string;
      mediaPath?: string;
      tokenHash?: string;
      expiresAt?: string;
    },
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
          mediaPath: input.mediaPath ?? null,
          tokenHash: input.tokenHash ?? null,
          lastHeartbeatAt: new Date(),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
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

  async endStreamSession(sessionId: string, context: CctvWriteContext, input?: EndStreamInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(cctvStreamsTable)
        .set({
          status: "ended",
          endedAt: new Date(),
          endedBy: input?.endedBy ?? null,
          endReason: input?.endReason ?? null,
        })
        .where(and(eq(cctvStreamsTable.sessionId, sessionId), eq(cctvStreamsTable.status, "active")))
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

  /**
   * Refresh the heartbeat of an active session (viewer liveness, Phase 4).
   * Returns false when the session is missing or already ended - the caller
   * surfaces that as a controlled 404 so the client re-requests a stream.
   */
  async touchHeartbeatBySessionId(sessionId: string): Promise<boolean> {
    const rows = await this.db
      .update(cctvStreamsTable)
      .set({ lastHeartbeatAt: new Date() })
      .where(and(eq(cctvStreamsTable.sessionId, sessionId), eq(cctvStreamsTable.status, "active")))
      .returning({ id: cctvStreamsTable.id });
    return rows.length > 0;
  }

  /** Load an active session by playback-token hash (external auth hook path). */
  async findActiveSessionByTokenHash(tokenHash: string): Promise<CctvStreamSession | null> {
    const rows = await this.db
      .select()
      .from(cctvStreamsTable)
      .where(and(eq(cctvStreamsTable.tokenHash, tokenHash), eq(cctvStreamsTable.status, "active")))
      .limit(1);
    return rows[0] ? toCctvStreamSession(rows[0]) : null;
  }

  /** Load an active session by its gateway streamId (cctv_streams.session_id). */
  async findActiveSessionBySessionId(sessionId: string): Promise<CctvStreamSession | null> {
    const rows = await this.db
      .select()
      .from(cctvStreamsTable)
      .where(and(eq(cctvStreamsTable.sessionId, sessionId), eq(cctvStreamsTable.status, "active")))
      .limit(1);
    return rows[0] ? toCctvStreamSession(rows[0]) : null;
  }

  /** Active session count for a camera (media-revocation reconciliation). */
  async countActiveByCamera(cameraId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(cctvStreamsTable)
      .where(and(eq(cctvStreamsTable.cameraId, cameraId), eq(cctvStreamsTable.status, "active")));
    return rows[0]?.count ?? 0;
  }

  /**
   * Sweeper candidates: active sessions whose token has expired, or whose
   * heartbeat is older than the grace window (token expiry always ends the
   * session; heartbeat staleness only matters while the token is still valid).
   * Rows without any heartbeat (legacy) are swept only by token expiry.
   */
  async findSweepCandidates(now: Date, graceMs: number): Promise<SweepCandidate[]> {
    const rows = await this.db
      .select({
        id: cctvStreamsTable.id,
        sessionId: cctvStreamsTable.sessionId,
        cameraId: cctvStreamsTable.cameraId,
        mediaPath: cctvStreamsTable.mediaPath,
        expiresAt: cctvStreamsTable.expiresAt,
        lastHeartbeatAt: cctvStreamsTable.lastHeartbeatAt,
      })
      .from(cctvStreamsTable)
      .where(
        and(
          eq(cctvStreamsTable.status, "active"),
          or(
            and(isNull(cctvStreamsTable.endedAt), lt(cctvStreamsTable.expiresAt, now)),
            lt(cctvStreamsTable.lastHeartbeatAt, new Date(now.getTime() - graceMs)),
          ),
        ),
      )
      .limit(100);

    return rows.map((row) => {
      const expired = row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime();
      // Token expiry wins over heartbeat staleness for attribution.
      const reason: StreamEndReason = expired ? "token_expired" : "heartbeat_timeout";
      return {
        id: row.id,
        sessionId: row.sessionId,
        cameraId: row.cameraId,
        mediaPath: row.mediaPath ?? null,
        reason,
      };
    });
  }

  /**
   * End a session by primary key (sweeper/admin path) with audit + outbox,
   * atomically (§25). Idempotent: already-ended sessions are left untouched.
   */
  async endStreamSessionById(id: string, context: CctvWriteContext, input: EndStreamInput): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(cctvStreamsTable)
        .set({
          status: "ended",
          endedAt: new Date(),
          endedBy: input.endedBy,
          endReason: input.endReason,
        })
        .where(and(eq(cctvStreamsTable.id, id), eq(cctvStreamsTable.status, "active")))
        .returning();

      const ended = rows[0];
      if (!ended) return false;

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
          sessionId: ended.sessionId,
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

      return true;
    });
  }

  /** Active session bound to a given gateway streamId (cctv_streams.id), if any. */
  async findActiveSessionByStreamId(streamId: string): Promise<CctvStreamSession | null> {
    const rows = await this.db
      .select()
      .from(cctvStreamsTable)
      .where(and(eq(cctvStreamsTable.id, streamId), eq(cctvStreamsTable.status, "active")))
      .limit(1);
    return rows[0] ? toCctvStreamSession(rows[0]) : null;
  }
}
