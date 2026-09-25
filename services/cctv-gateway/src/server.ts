import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply } from "fastify";
import { loadConfig, type CctvGatewayConfig } from "./config.js";
import { createStreamToken, verifyStreamToken } from "./auth/token.js";
import { MediamtxClient } from "./mediamtx/client.js";
import {
  MediaControlService,
  type CameraContext,
  type PathStatistics,
} from "./mediamtx/media-control-service.js";
import type { CameraProvider, CameraRef } from "./providers/provider.js";
import { SimulatedCameraProvider } from "./providers/simulated-provider.js";
import { ProviderRegistry } from "./providers/provider-registry.js";

/**
 * Timing-safe comparison of the service secret presented by the NETRAM API.
 * Empty configured secret disables the check (explicit dev escape hatch).
 */
function isAuthorizedService(requestSecret: string | undefined, configuredSecret: string): boolean {
  if (configuredSecret.length === 0) return true;
  if (!requestSecret) return false;
  const a = Buffer.from(requestSecret);
  const b = Buffer.from(configuredSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface BuildServerOptions {
  provider?: CameraProvider;
  /** Override the MediaMTX client (tests inject a stub here). */
  mediamtxClient?: MediamtxClient;
  config?: Partial<CctvGatewayConfig>;
}

/**
 * CCTV Gateway — MEDIA CONTROL BRIDGE (Phase 3, AGENTS.md §7, §42).
 *
 * The gateway NO LONGER relays video bytes. MediaMTX owns the data plane:
 * RTSP ingest, fan-out, WebRTC/WHEP. This service is control-plane only:
 *   - camera context arrives from the NETRAM API (DB is the source of truth)
 *   - paths are provisioned in MediaMTX on demand
 *   - health is derived from real MediaMTX state (never from DB rows)
 *   - playback contracts are prepared here, consumed directly from MediaMTX
 *
 * Service-to-service auth (§14): the NETRAM API presents the shared
 * NETRAM_CCTV_SERVICE_SECRET on control-plane routes. Media endpoints keep
 * the existing signed stream tokens.
 */
export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const baseConfig = loadConfig();
  const config: CctvGatewayConfig = {
    ...baseConfig,
    ...options.config,
  };

  // Provider layer: resolves/validates ingest sources. The simulated
  // provider is the dev-rig default for cameras no specific provider claims.
  const simulated = options.provider ?? new SimulatedCameraProvider();
  const provider: CameraProvider =
    options.provider ?? new ProviderRegistry([simulated]).setDefaultProvider("simulated");

  // Media control bridge.
  const mediamtx =
    options.mediamtxClient ??
    new MediamtxClient({
      baseUrl: config.mediamtxApiUrl,
      username: config.mediamtxApiUsername,
      password: config.mediamtxApiPassword,
    });
  const media = new MediaControlService({
    mediamtx,
    providers: provider,
    whepPublicUrl: config.mediamtxWhepPublicUrl,
    devIngestSource: config.devIngestSource,
    streamSecret: config.streamSecret,
  });

  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });

  /** Service auth guard for control-plane routes (§14). */
  function requireServiceSecret(reply: FastifyReply, request: { headers: Record<string, unknown> }): boolean {
    const header = request.headers["x-netram-service-secret"];
    const presented = Array.isArray(header) ? header[0] : header;
    if (!isAuthorizedService(presented as string | undefined, config.serviceSecret)) {
      void reply.code(401).send({
        error: { code: "UNAUTHORIZED_SERVICE", message: "Missing or invalid service credential." },
      });
      return false;
    }
    return true;
  }

  /** Parse and validate the camera context passed by the NETRAM API. */
  function parseCameraContext(body: unknown): CameraContext | null {
    if (typeof body !== "object" || body === null) return null;
    const b = body as Record<string, unknown>;
    if (
      typeof b.id !== "string" ||
      typeof b.provider !== "string" ||
      typeof b.protocol !== "string" ||
      typeof b.endpoint !== "string" ||
      b.id.length === 0
    ) {
      return null;
    }
    return { id: b.id, provider: b.provider, protocol: b.protocol, endpoint: b.endpoint };
  }

  // Liveness probe
  app.get("/health", async () => ({
    status: "ok",
    service: "cctv-gateway",
    role: "media-control-bridge",
  }));

  // Media control plane liveness (MediaMTX reachability).
  app.get("/media/health", async () => {
    const health = await mediamtx.checkHealth();
    return {
      status: health.ok ? "ok" : "unavailable",
      mediamtx: health.ok ? "reachable" : "unreachable",
      detail: health.detail,
    };
  });

  // List cameras known to the provider layer (dev/diagnostics; the NETRAM DB
  // remains the authoritative catalog — this reflects provider-side view).
  app.get("/cameras", async () => {
    const cameras: CameraRef[] = await provider.listCameras();
    return { cameras };
  });

  // REAL camera health, derived from MediaMTX path state.
  app.post("/cameras/health", async (request, reply) => {
    if (!requireServiceSecret(reply, request)) return reply;
    const camera = parseCameraContext(request.body);
    if (!camera) {
      return reply.code(400).send({
        error: { code: "INVALID_CAMERA_CONTEXT", message: "Valid camera context is required." },
      });
    }
    return media.cameraHealth(camera);
  });

  // Media statistics for a camera's path.
  app.post("/cameras/stats", async (request, reply) => {
    if (!requireServiceSecret(reply, request)) return reply;
    const camera = parseCameraContext(request.body);
    if (!camera) {
      return reply.code(400).send({
        error: { code: "INVALID_CAMERA_CONTEXT", message: "Valid camera context is required." },
      });
    }
    const stats: PathStatistics = await media.pathStatistics(camera);
    return stats;
  });

  // Prepare an authorized playback contract (replaces the raw MPEG-TS relay).
  app.post("/cameras/:id/streams", async (request, reply) => {
    if (!requireServiceSecret(reply, request)) return reply;
    const { id } = request.params as { id: string };
    const body = (request.body as (Record<string, unknown> & { ttlSeconds?: number }) | null) ?? {};
    const ttl = Math.max(30, Math.min(3600, body.ttlSeconds ?? 300));

    const camera = parseCameraContext(body);
    if (!camera || camera.id !== id) {
      return reply.code(400).send({
        error: {
          code: "INVALID_CAMERA_CONTEXT",
          message: "Request body must carry the camera context matching the URL id.",
        },
      });
    }

    // Derivation fails closed for unusable camera endpoints — surface as a
    // controlled 4xx, never a 500 (the caller passed an unusable camera).
    // (Phase 4: ensureCameraPath below performs the same fail-closed
    // derivation; this pre-check keeps the contract explicit.)
    try {
      media.mediaPathFor(camera);
    } catch {
      return reply.code(400).send({
        error: {
          code: "INVALID_CAMERA_CONTEXT",
          message: "Camera context cannot yield a usable media configuration.",
        },
      });
    }

    const streamId = randomUUID();
    const exp = Math.floor(Date.now() / 1000) + ttl;

    try {
      // Provision first: the token must carry the exact media path (Phase 4)
      // and path derivation fails closed for unusable camera endpoints.
      const { mediaPath } = await media.ensureCameraPath(camera);
      const token = createStreamToken({ streamId, cameraId: id, mediaPath, exp }, config.streamSecret);
      const expiresAt = new Date(exp * 1000).toISOString();

      const playback = await media.preparePlayback(camera, { streamId, token, expiresAt });
      return reply.code(201).send({
        streamId,
        cameraId: id,
        streamUrl: playback.whepUrl,
        expiresAt,
        token,
        playback: {
          protocol: playback.protocol,
          whepUrl: playback.whepUrl,
          token,
          mediaPath: playback.mediaPath,
        },
      });
    } catch (err) {
      app.log.warn(err, "playback preparation failed");
      return reply.code(422).send({
        error: {
          code: "PLAYBACK_PREPARATION_FAILED",
          message: err instanceof Error ? err.message : "Unable to prepare playback.",
        },
      });
    }
  });

  // ---- Phase 4 media session control (service-plane operations) ----

  // Verify a playback token against the live media plane. Used by the NETRAM
  // API's external-auth hook for cross-checking and by dev verification.
  app.post("/media/tokens/verify", async (request, reply) => {
    if (!requireServiceSecret(reply, request)) return reply;
    const body = request.body as { token?: string } | null;
    if (typeof body?.token !== "string" || body.token.length === 0) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "'token' is required." },
      });
    }
    return media.verifyPlaybackToken(body.token);
  });

  // Live viewer state for a media path (reconciliation input for the sweeper).
  app.get("/media/sessions/:mediaPath", async (request, reply) => {
    if (!requireServiceSecret(reply, request)) return reply;
    const { mediaPath } = request.params as { mediaPath: string };
    if (mediaPath.length === 0 || mediaPath.length > 200) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid media path." },
      });
    }
    try {
      return await media.sessionView(decodeURIComponent(mediaPath));
    } catch (err) {
      return reply.code(502).send({
        error: {
          code: "MEDIA_CONTROL_UNAVAILABLE",
          message: err instanceof Error ? err.message : "MediaMTX unreachable.",
        },
      });
    }
  });

  // Disconnect a specific WebRTC reader (admin revoke flow support), or all
  // readers correlated to a NETRAM session (Phase 5 session end).
  app.post("/media/sessions/:mediaPath/kick", async (request, reply) => {
    if (!requireServiceSecret(reply, request)) return reply;
    const { mediaPath } = request.params as { mediaPath: string };
    const body = request.body as { whepSessionId?: string; netramSessionId?: string } | null;
    const hasWhep = typeof body?.whepSessionId === "string" && body.whepSessionId.length > 0;
    const hasNetram =
      typeof body?.netramSessionId === "string" && body.netramSessionId.length > 0;
    if (!hasWhep && !hasNetram) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "'whepSessionId' or 'netramSessionId' is required.",
        },
      });
    }
    try {
      const kicked = hasWhep
        ? (await mediamtx.kickReader(body!.whepSessionId!))
          ? 1
          : 0
        : await mediamtx.kickReadersByNetramSession(body!.netramSessionId!);
      return { kicked, mediaPath: decodeURIComponent(mediaPath) };
    } catch (err) {
      return reply.code(502).send({
        error: {
          code: "MEDIA_CONTROL_UNAVAILABLE",
          message: err instanceof Error ? err.message : "MediaMTX unreachable.",
        },
      });
    }
  });

  // Locate the MediaMTX WebRTC reader(s) correlated to a NETRAM session
  // (Phase 5 correlation — input for the API's session-end flow and sweeper).
  app.get("/media/sessions/by-netram-session/:netramSessionId", async (request, reply) => {
    if (!requireServiceSecret(reply, request)) return reply;
    const { netramSessionId } = request.params as { netramSessionId: string };
    try {
      const sessions = await mediamtx.listWebRtcSessions();
      const matches = sessions.filter((s) => {
        const q = typeof s["query"] === "string" ? (s["query"] as string) : "";
        return new URLSearchParams(q).get("netramSession") === netramSessionId;
      });
      return {
        netramSessionId,
        readers: matches.map((s) => ({
          id: s.id,
          path: s["path"] ?? null,
          established: s["peerConnectionEstablished"] ?? null,
          created: s["created"] ?? null,
        })),
      };
    } catch (err) {
      return reply.code(502).send({
        error: {
          code: "MEDIA_CONTROL_UNAVAILABLE",
          message: err instanceof Error ? err.message : "MediaMTX unreachable.",
        },
      });
    }
  });

  // Signed playback-token verification (browser-facing media handshake goes
  // directly to MediaMTX; this endpoint exists so Phase 4 session control and
  // local verification can validate a minted token without media bytes).
  app.get("/streams/:streamId", async (request, reply) => {
    const { streamId } = request.params as { streamId: string };
    const query = request.query as { token?: string; cameraId?: string };

    if (!query.token) {
      return reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing stream authorization token",
        },
      });
    }

    const payload = verifyStreamToken(query.token, config.streamSecret);
    if (!payload || payload.streamId !== streamId) {
      return reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired stream token",
        },
      });
    }

    return {
      streamId,
      cameraId: payload.cameraId,
      valid: true,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  });

  // Snapshot capture for advisory AI pipeline / inspection verification (§7, §36)
  app.get("/cameras/:id/snapshot", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const snapshot = await provider.acquireSnapshot(id);
      void reply.header("Content-Type", snapshot.contentType);
      void reply.header("Content-Length", snapshot.data.length);
      void reply.header("Cache-Control", "no-cache");
      return reply.send(snapshot.data);
    } catch (err) {
      return reply.code(404).send({
        error: {
          code: "CAMERA_NOT_FOUND",
          message: err instanceof Error ? err.message : `Camera not found: ${id}`,
        },
      });
    }
  });

  return app;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadConfig();
  buildServer()
    .then(async (app) => {
      await app.listen({ port: config.port, host: config.host });
      app.log.info(`CCTV Gateway (media control bridge) listening on ${config.host}:${config.port}`);
    })
    .catch((err) => {
      console.error("Failed to start CCTV Gateway:", err);
      process.exit(1);
    });
}
