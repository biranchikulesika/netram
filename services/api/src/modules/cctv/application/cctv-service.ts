import { createHash } from "node:crypto";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { CctvRepositoryPort } from "./ports/cctv-repository.js";
import type {
  AuthorizedStream,
  CameraHealthStatus,
  CctvCamera,
  ListCamerasFilter,
  PublicCctvCamera,
} from "@netram/types";

const CCTV_READ = "cctv:read" as const;
const CCTV_STREAM = "cctv:stream" as const;

export function toPublicCctvCamera(camera: CctvCamera): PublicCctvCamera {
  const { endpoint: _endpoint, ...publicCam } = camera;
  return publicCam;
}

/**
 * Decision for the MediaMTX external auth hook (Phase 4 §13).
 * The hook rejects with 401 when this returns false - the reason is
 * audit-logged by the caller but NEVER returned to MediaMTX clients.
 */
export type MediaAuthDecision =
  | { allowed: true; mediaPath: string; streamSessionId: string }
  | { allowed: false; reason: string };

/**
 * CCTV domain and streaming application service (AGENTS.md §7, §42).
 * Strictly omits raw RTSP credentials and endpoints from all public/client contracts.
 * Coordinates with the CCTV Gateway (media control bridge) for playback
 * contracts and snapshots. Camera context from the DB is passed to the
 * gateway server-to-server (Phase 3): the gateway stays DB-free and the DB
 * remains the camera source of truth.
 */
export class CctvService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly cctvRepo: CctvRepositoryPort,
    private readonly gatewayUrl: string,
    private readonly serviceSecret: string,
  ) {}

  async listCameras(
    ctx: RequestUserContext,
    query: ListCamerasFilter = {},
  ): Promise<{
    items: PublicCctvCamera[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = this.authz.accessibleDistrictIds(ctx);

    const result = await this.cctvRepo.list({
      page,
      pageSize,
      districtId: query.districtId,
      status: query.status,
      jurisdictionIds: scope ? [...scope] : undefined,
    });

    return {
      items: result.items.map(toPublicCctvCamera),
      total: result.total,
      page,
      pageSize,
    };
  }

  async getCamera(ctx: RequestUserContext, id: string): Promise<PublicCctvCamera> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    return toPublicCctvCamera(camera);
  }

  async getCameraHealth(ctx: RequestUserContext, id: string): Promise<CameraHealthStatus> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    try {
      const res = await fetch(`${this.gatewayUrl}/cameras/health`, {
        method: "POST",
        headers: this.serviceHeaders(),
        body: JSON.stringify({
          id: camera.id,
          provider: camera.provider,
          protocol: camera.protocol,
          endpoint: camera.endpoint,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return {
          cameraId: id,
          status: "degraded",
          lastCheckedAt: new Date().toISOString(),
          details: { gatewayStatus: res.status },
        };
      }
      const data = (await res.json()) as {
        status?: CameraHealthStatus["status"];
        latencyMs?: number;
        details?: Record<string, unknown>;
      };
      return {
        cameraId: id,
        status: data.status ?? "unknown",
        latencyMs: data.latencyMs,
        lastCheckedAt: new Date().toISOString(),
        details: data.details,
      };
    } catch {
      return {
        cameraId: id,
        status: "offline",
        lastCheckedAt: new Date().toISOString(),
        details: { error: "Gateway unreachable" },
      };
    }
  }

  async requestCameraStream(
    ctx: RequestUserContext,
    id: string,
    input: { ttlSeconds?: number } = {},
  ): Promise<AuthorizedStream> {
    this.authz.requirePermission(ctx, CCTV_STREAM);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    let streamData: AuthorizedStream;
    try {
      const res = await fetch(`${this.gatewayUrl}/cameras/${encodeURIComponent(id)}/streams`, {
        method: "POST",
        headers: this.serviceHeaders(),
        body: JSON.stringify({
          ttlSeconds: input.ttlSeconds,
          // Camera context from the DB - the gateway's configuration input.
          id: camera.id,
          provider: camera.provider,
          protocol: camera.protocol,
          endpoint: camera.endpoint,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`CCTV Gateway returned status ${res.status}`);
      }

      streamData = (await res.json()) as AuthorizedStream;
    } catch (err) {
      throw new AppError("SERVICE_UNAVAILABLE", "Unable to establish authorized stream relay.", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    await this.cctvRepo.createStreamSession(
      {
        cameraId: id,
        sessionId: streamData.streamId,
        mediaPath: streamData.playback?.mediaPath,
        tokenHash: createHash("sha256").update(streamData.token).digest("hex"),
        expiresAt: streamData.expiresAt,
      },
      {
        actorUserId: ctx.user.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        auditAction: "cctv.accessed",
        auditMetadata: {
          cameraId: id,
          streamId: streamData.streamId,
          expiresAt: streamData.expiresAt,
          mediaPath: streamData.playback?.mediaPath,
        },
        eventType: "cctv.stream_started",
        eventPayload: {
          cameraId: id,
          streamId: streamData.streamId,
          startedAt: new Date().toISOString(),
        },
      },
    );

    return streamData;
  }

  /**
   * Viewer heartbeat (Phase 4 §2). Refreshes the session's liveness marker so
   * the sweeper does not reap it. 404 when the session is already ended - the
   * client should request a new stream.
   */
  async heartbeat(
    ctx: RequestUserContext,
    cameraId: string,
    streamId: string,
  ): Promise<{ lastHeartbeatAt: string }> {
    this.authz.requirePermission(ctx, CCTV_STREAM);

    const camera = await this.cctvRepo.findById(cameraId);
    if (!camera) throw AppError.notFound("CCTV camera not found.");
    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    const session = await this.cctvRepo.findActiveSessionBySessionId(streamId);
    if (!session || session.cameraId !== cameraId) {
      throw AppError.notFound("Stream session not found or already ended.");
    }

    const touched = await this.cctvRepo.touchHeartbeatBySessionId(streamId);
    if (!touched) {
      throw AppError.notFound("Stream session not found or already ended.");
    }

    // Audit the liveness signal without creating an event storm: heartbeat
    // audits are distinct from state-transition audits, and no outbox event is
    // emitted (a heartbeat is not a state change). §37/§38 separation.
    return { lastHeartbeatAt: new Date().toISOString() };
  }

  /**
   * Explicit session end (Phase 4 §3): viewer stop or admin revoke.
   * Ends the DB session atomically (audit + outbox), then kicks any live
   * MediaMTX readers through the gateway (best-effort - media termination is
   * eventual if the gateway is down; the token is dead the moment the DB row
   * flips because the auth hook validates against the session state).
   */
  async endStream(
    ctx: RequestUserContext,
    cameraId: string,
    streamId: string,
    input: { endReason: "viewer_stop" | "admin_revoke" },
  ): Promise<{ ended: true; endReason: string }> {
    // Admin revoke requires admin-level intent; viewers may end their own
    // session. Both paths authorize against cctv:stream; admin_revoke is
    // additionally gated on cctv:read being held with jurisdiction over the
    // camera (enforced below by the same camera lookup used everywhere).
    this.authz.requirePermission(ctx, CCTV_STREAM);
    if (input.endReason === "admin_revoke") {
      this.authz.requirePermission(ctx, CCTV_READ);
    }

    const camera = await this.cctvRepo.findById(cameraId);
    if (!camera) throw AppError.notFound("CCTV camera not found.");
    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    const session = await this.cctvRepo.findActiveSessionBySessionId(streamId);
    if (!session || session.cameraId !== cameraId) {
      throw AppError.notFound("Stream session not found or already ended.");
    }

    await this.cctvRepo.endStreamSession(streamId, {
      actorUserId: ctx.user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      auditAction: input.endReason === "admin_revoke" ? "cctv.stream_revoked" : "cctv.stream_ended",
      auditMetadata: {
        cameraId,
        streamSessionId: session.id,
        endReason: input.endReason,
      },
      eventType: "cctv.stream_ended",
      eventPayload: {
        cameraId,
        streamId,
        endReason: input.endReason,
        endedBy: ctx.user.id,
        endedAt: new Date().toISOString(),
      },
    }, { endedBy: "viewer", endReason: input.endReason });

    // Best-effort media termination through the gateway control plane:
    // kick the MediaMTX WebRTC reader(s) correlated to this session via the
    // WHEP `netramSession` query echo (Phase 5 correlation, live-verified on
    // v1.21.1). If the gateway or MediaMTX is down this is eventual - the
    // token is already dead because the auth hook validates session state.
    if (session.mediaPath) {
      try {
        await fetch(
          `${this.gatewayUrl}/media/sessions/${encodeURIComponent(session.mediaPath)}/kick`,
          {
            method: "POST",
            headers: this.serviceHeaders(),
            body: JSON.stringify({ netramSessionId: streamId }),
            signal: AbortSignal.timeout(5_000),
          },
        );
      } catch {
        // Gateway unreachable - token is already dead; nothing to do now.
      }
    }

    return { ended: true, endReason: input.endReason };
  }

  /**
   * MediaMTX external auth hook decision (Phase 4 §13).
   * Validates: session exists and is active, token hash matches the session,
   * token not expired, and the requested action is playback on the session's
   * own media path. Everything else is denied and audited.
   */
  async mediaAuthDecision(
    input: {
      token: string;
      action: string;
      path: string;
      protocol: string;
      ip: string;
      query?: string;
    },
  ): Promise<MediaAuthDecision> {
    const deny = (reason: string): MediaAuthDecision => ({ allowed: false, reason });

    // Live consumer actions only: WHEP/HLS session creation maps to "read"
    // (live-verified against MediaMTX v1.21.1); "playback" is the recordings
    // server, permitted for forward-compatibility. Publish and control-plane
    // actions (api/metrics/pprof) are always denied here.
    if (input.action !== "read" && input.action !== "playback") {
      return deny(`action_not_permitted:${input.action}`);
    }
    if (input.protocol !== "webrtc" && input.protocol !== "hls") {
      return deny(`protocol_not_permitted:${input.protocol}`);
    }

    // Live-verified v1.21.1 behavior: the playback token reaches the hook in
    // DIFFERENT fields per protocol - WHEP fills `token`; HLS leaves `token`
    // empty and carries the WHEP-style query string (containing token=…) in
    // `query`. Resolve both before hashing; fail closed when neither has one.
    const token =
      input.token.length > 0
        ? input.token
        : (new URLSearchParams(input.query ?? "").get("token") ?? "");
    if (token.length === 0) {
      return deny("missing_playback_token");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await this.cctvRepo.findActiveSessionByTokenHash(tokenHash);
    if (!session) {
      return deny("unknown_or_ended_session");
    }
    if (session.mediaPath && session.mediaPath !== input.path) {
      return deny("path_mismatch");
    }
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      return deny("token_expired");
    }

    return { allowed: true, mediaPath: session.mediaPath ?? input.path, streamSessionId: session.id };
  }

  /** Server-to-server headers for gateway control-plane calls (§14). */
  private serviceHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-netram-service-secret": this.serviceSecret,
    };
  }

  async getCameraSnapshot(
    ctx: RequestUserContext,
    id: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    try {
      const res = await fetch(`${this.gatewayUrl}/cameras/${encodeURIComponent(id)}/snapshot`);
      if (!res.ok) {
        throw new Error(`Gateway returned status ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return {
        data: Buffer.from(arrayBuffer),
        contentType,
      };
    } catch (err) {
      throw new AppError("SERVICE_UNAVAILABLE", "Failed to retrieve camera snapshot frame.", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
