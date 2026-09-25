import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  idParamsSchema,
  listCamerasQuerySchema,
  cctvCameraPageSchema,
  publicCctvCameraSchema,
  cameraHealthStatusSchema,
  requestStreamSchema,
  authorizedStreamSchema,
  mediaAuthHookRequestSchema,
  streamHeartbeatSchema,
  endStreamSchema,
} from "@netram/validation";
import { timingSafeEqual } from "node:crypto";
import type { ListCamerasQuery } from "@netram/validation";
import { z } from "zod";


export async function registerCctvRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const cctvService = container.cctvService;
  const paramsSchema = toJsonSchema("CctvCameraIdParams", idParamsSchema);
  const streamParamsSchema = toJsonSchema(
    "CctvStreamParams",
    idParamsSchema.extend({ streamId: z.string().min(8).max(100) }),
  );

  // List CCTV cameras (omits raw credentials and endpoints)
  app.get(
    "/cctv/cameras",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ListCamerasQuery", listCamerasQuerySchema),
        response: { 200: toJsonSchema("CctvCameraPage", cctvCameraPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as ListCamerasQuery;
      return cctvService.listCameras(request.netram!, q);
    },
  );

  // Get CCTV camera details
  app.get(
    "/cctv/cameras/:id",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("PublicCctvCamera", publicCctvCameraSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return cctvService.getCamera(request.netram!, id);
    },
  );

  // Live camera health check via CCTV Gateway
  app.get(
    "/cctv/cameras/:id/health",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("CameraHealthStatus", cameraHealthStatusSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return cctvService.getCameraHealth(request.netram!, id);
    },
  );

  // Request authorized stream relay token
  app.post(
    "/cctv/cameras/:id/streams",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("RequestStreamInput", requestStreamSchema),
        response: { 201: toJsonSchema("AuthorizedStream", authorizedStreamSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as { ttlSeconds?: number } | undefined) ?? {};
      const result = await cctvService.requestCameraStream(request.netram!, id, body);
      return reply.code(201).send(result);
    },
  );

  // Snapshot frame for advisory AI anomaly detection / inspection verification (§7, §36)
  app.get(
    "/cctv/cameras/:id/snapshot",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const snapshot = await cctvService.getCameraSnapshot(request.netram!, id);
      void reply.header("Content-Type", snapshot.contentType);
      void reply.header("Content-Length", snapshot.data.length);
      return reply.send(snapshot.data);
    },
  );

  // ---- Phase 4: session lifecycle ----

  // Viewer heartbeat: keeps a session alive against the sweeper (§29).
  app.post(
    "/cctv/cameras/:id/streams/:streamId/heartbeat",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: streamParamsSchema,
        body: toJsonSchema("StreamHeartbeatInput", streamHeartbeatSchema),
        response: { 200: toJsonSchema("StreamHeartbeatResult", z.object({ lastHeartbeatAt: z.string().datetime() })) },
      },
    },
    async (request) => {
      const { id, streamId } = request.params as { id: string; streamId: string };
      return cctvService.heartbeat(request.netram!, id, streamId);
    },
  );

  // Explicit session end: viewer stop or admin revoke (§32 — audited).
  app.delete(
    "/cctv/cameras/:id/streams/:streamId",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: streamParamsSchema,
        body: toJsonSchema("EndStreamInput", endStreamSchema),
        response: {
          200: toJsonSchema(
            "EndStreamResult",
            z.object({ ended: z.literal(true), endReason: z.string() }),
          ),
        },
      },
    },
    async (request) => {
      const { id, streamId } = request.params as { id: string; streamId: string };
      const body =
        (request.body as { endReason?: "viewer_stop" | "admin_revoke" } | undefined) ?? {};
      const endReason = body.endReason ?? "viewer_stop";
      return cctvService.endStream(request.netram!, id, streamId, { endReason });
    },
  );
}

/**
 * MediaMTX external authentication hook (Phase 4 §13).
 *
 * Registered OUTSIDE /api/v1 and OUTSIDE the app-level auth hook: MediaMTX
 * presents a dedicated service secret, not a user JWT. This is the media/data
 * plane's authorization boundary — every RTSP publish, WHEP/HLS read, and
 * playback action hits this endpoint (live-verified behavior: 2xx allows,
 * otherwise the client is rejected).
 *
 * Security: the hook secret gates the endpoint (query parameter embedded in
 * the MediaMTX-configured URL, or header for other callers — MediaMTX cannot
 * send custom headers); decisions are fail-closed; denials are audited
 * (cctv.media_auth_denied) with NO credential material in the audit record.
 */
export async function registerMediaAuthHookRoute(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  app.post(
    "/media/auth",
    {
      config: { public: true },
      schema: {
        tags: ["cctv"],
        body: toJsonSchema("MediaAuthHookRequest", mediaAuthHookRequestSchema),
      },
    },
    async (request, reply) => {
      const hookSecret = container.config.NETRAM_MEDIAMTX_HOOK_SECRET;
      // MediaMTX posts ONLY its fixed JSON payload — it cannot send custom
      // headers — so the shared secret is embedded in the configured
      // authHTTPAddress URL as a query parameter (standard webhook pattern
      // for fixed-URL callbacks). Non-MediaMTX callers may use the header.
      const header = request.headers["x-mediamtx-hook-secret"];
      const querySecret =
        typeof request.query === "object" && request.query !== null
          ? (request.query as Record<string, unknown>).hookSecret
          : undefined;
      const presented =
        (Array.isArray(header) ? header[0] : header) ??
        (typeof querySecret === "string" ? querySecret : undefined);

      const a = Buffer.from(presented ?? "");
      const b = Buffer.from(hookSecret);
      const secretOk = a.length === b.length && timingSafeEqual(a, b);
      if (!secretOk) {
        return reply.code(401).send({});
      }

      const parsed = mediaAuthHookRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(401).send({});
      }

      const decision = await container.cctvService.mediaAuthDecision(parsed.data);
      if (!decision.allowed) {
        void container.auditRepo
          .append({
            action: "cctv.media_auth_denied",
            actorUserId: null,
            requestId: request.id,
            ipAddress: parsed.data.ip || request.ip,
            metadata: {
              reason: decision.reason,
              action: parsed.data.action,
              path: parsed.data.path,
              protocol: parsed.data.protocol,
              // NO token/user material in the audit record (§39).
            },
          })
          .catch(() => {
            // Auditing must never decide the auth outcome.
          });
        return reply.code(401).send({});
      }

      return reply.code(200).send({});
    },
  );
}
