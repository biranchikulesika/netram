import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { loadConfig, type CctvGatewayConfig } from "./config.js";
import { createStreamToken, verifyStreamToken } from "./auth/token.js";
import type { CameraProvider } from "./providers/provider.js";
import { SimulatedCameraProvider } from "./providers/simulated-provider.js";

export interface BuildServerOptions {
  provider?: CameraProvider;
  config?: Partial<CctvGatewayConfig>;
}

/**
 * CCTV Gateway server (AGENTS.md §7, §42).
 *
 * Provider adapters plug in behind CameraProvider. Clients only ever receive
 * short-lived, signed relay URLs and tokens — raw RTSP credentials and internal
 * network endpoints never reach browsers or mobile clients.
 */
export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const baseConfig = loadConfig();
  const config: CctvGatewayConfig = {
    ...baseConfig,
    ...options.config,
  };

  const provider = options.provider ?? new SimulatedCameraProvider();

  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });

  // Health probe
  app.get("/health", async () => ({
    status: "ok",
    service: "cctv-gateway",
  }));

  // List cameras known to provider
  app.get("/cameras", async () => {
    const cameras = await provider.listCameras();
    return { cameras };
  });

  // Camera health
  app.get("/cameras/:id/health", async (request) => {
    const { id } = request.params as { id: string };
    const status = await provider.cameraHealth(id);
    return {
      cameraId: id,
      status,
      latencyMs: 35,
      lastCheckedAt: new Date().toISOString(),
    };
  });

  // Request authorized stream relay URL & token
  app.post("/cameras/:id/streams", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { ttlSeconds?: number } | undefined) ?? {};
    const ttl = Math.max(30, Math.min(3600, body.ttlSeconds ?? 300));

    const streamId = randomUUID();
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const token = createStreamToken(
      {
        streamId,
        cameraId: id,
        exp,
      },
      config.streamSecret,
    );

    const streamUrl = `${config.gatewayUrl}/streams/${streamId}?token=${token}`;
    const expiresAt = new Date(exp * 1000).toISOString();

    return reply.code(201).send({
      streamId,
      cameraId: id,
      streamUrl,
      expiresAt,
      token,
    });
  });

  // Authorized stream relay endpoint (validates signed HMAC token)
  app.get("/streams/:streamId", async (request, reply) => {
    const { streamId } = request.params as { streamId: string };
    const query = request.query as { token?: string };

    if (!query.token) {
      return reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing stream relay authorization token",
        },
      });
    }

    const payload = verifyStreamToken(query.token, config.streamSecret);
    if (!payload || payload.streamId !== streamId) {
      return reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired stream relay token",
        },
      });
    }

    // Return simulated MPEG-TS media chunk relay
    // Starts with MPEG-TS sync byte (0x47)
    const simulatedTsPacket = Buffer.alloc(188, 0);
    simulatedTsPacket[0] = 0x47; // TS Sync Byte

    void reply.header("Content-Type", "video/mp2t");
    void reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    return reply.send(simulatedTsPacket);
  });

  // Snapshot capture for advisory AI pipeline / inspection verification (§7, §36)
  app.get("/cameras/:id/snapshot", async (request, reply) => {
    const { id } = request.params as { id: string };
    const snapshot = await provider.acquireSnapshot(id);

    void reply.header("Content-Type", snapshot.contentType);
    void reply.header("Content-Length", snapshot.data.length);
    void reply.header("Cache-Control", "no-cache");
    return reply.send(snapshot.data);
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  buildServer()
    .then(async (app) => {
      await app.listen({ port: config.port, host: config.host });
      app.log.info(`CCTV Gateway listening on ${config.host}:${config.port}`);
    })
    .catch((err) => {
      console.error("Failed to start CCTV Gateway:", err);
      process.exit(1);
    });
}
