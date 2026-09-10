import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { pingDatabase } from "@netram/data";

export async function registerHealthRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  app.get(
    "/health",
    {
      config: { public: true },
      schema: {
        tags: ["system"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              service: { type: "string" },
            },
            required: ["status", "service"],
          },
        },
      },
    },
    async () => ({ status: "ok", service: "api" }),
  );

  app.get(
    "/ready",
    {
      config: { public: true },
      schema: {
        tags: ["system"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              database: { type: "string" },
            },
            required: ["status", "database"],
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              database: { type: "string" },
            },
            required: ["status", "database"],
          },
        },
      },
    },
    async (request, reply) => {
      try {
        await pingDatabase(container.db);
        return { status: "ready", database: "ok" };
      } catch (err) {
        const e = err as Error;
        app.log.error({ err: e }, "Readiness check failed");
        void reply.code(503);
        return { status: "not_ready", database: "error" };
      }
    },
  );
}
