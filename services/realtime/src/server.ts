import Fastify from "fastify";
import { WebSocketServer, type WebSocket } from "ws";
import { getDb, OutboxRepository, pingDatabase } from "@netram/data";
import type { RealtimeConfig } from "./config.js";
import { Hub } from "./hub.js";
import { OutboxPoller } from "./outbox-poller.js";
import { ApiAuthorizer } from "./authorizer.js";

export interface RealtimeServer {
  port: number;
  start(): Promise<void>;
  close(): Promise<void>;
  hub: Hub;
}

export function buildRealtimeServer(config: RealtimeConfig): RealtimeServer {
  const app = Fastify({ logger: { level: config.logLevel } });
  const db = getDb(config.databaseUrl);
  const hub = new Hub();
  const poller = new OutboxPoller(
    new OutboxRepository(db),
    hub,
    config.pollIntervalMs,
    config.maxOutboxBatch,
  );
  const authorizer = new ApiAuthorizer(config.apiUrl);

  app.get("/health", { config: { public: true } }, async () => ({
    status: "ok",
    service: "realtime",
  }));

  app.get("/ready", { config: { public: true } }, async (request, reply) => {
    try {
      await pingDatabase(db);
      return { status: "ready", database: "ok" };
    } catch {
      void reply.code(503);
      return { status: "not_ready", database: "error" };
    }
  });

  // WebSocket upgrade handling. The HTTP layer accepts the upgrade; the token
  // is validated and topics authorized against the API before subscribing.
  const wss = new WebSocketServer({ noServer: true });

  app.server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    const topics = (url.searchParams.get("topics") ?? "").split(",").filter(Boolean);

    if (!token) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      void authorizeAndSubscribe(ws, token, topics).catch((err: unknown) => {
        app.log.error({ err }, "Realtime subscription rejected");
        ws.close(4001, "unauthorized");
      });
    });
  });

  async function authorizeAndSubscribe(
    ws: WebSocket,
    token: string,
    topics: string[],
  ): Promise<void> {
    const allowedTopics = await authorizer.authorizeTopics(token, topics);
    if (allowedTopics.length === 0) {
      ws.close(4001, "no permitted topics");
      return;
    }
    hub.subscribe({ socket: ws, allowedTopics });
    ws.send(JSON.stringify({ event: "netram.authorized", data: { allowedTopics } }));
  }

  return {
    port: config.port,
    hub,
    async start() {
      await app.listen({ port: config.port, host: "0.0.0.0" });
      poller.start();
      app.log.info(`Realtime service listening on :${config.port}`);
    },
    async close() {
      poller.stop();
      wss.close();
      await app.close();
    },
  };
}
