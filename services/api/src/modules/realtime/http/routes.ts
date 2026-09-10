import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { realtimeAuthorizeSchema } from "@netram/validation";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";

const TOPIC_NAMESPACE_OVERRIDES: Record<string, string> = {
  evidence: "evidence:create",
  observation: "observation:create",
  ai_anomaly: "ai:anomaly:read",
  anomaly: "ai:anomaly:read",
  vc_session: "vc_session:read",
  vc: "vc_session:read",
  attendance: "attendance:monitor:read",
};

function topicPermission(topic: string): string {
  const namespace = topic.split(".")[0];
  if (!namespace) return "";
  return TOPIC_NAMESPACE_OVERRIDES[namespace] ?? `${namespace}:read`;
}

/**
 * Realtime delivery is authorization-aware. The API (the authority) decides
 * which topics a connecting client may subscribe to; the realtime service only
 * relays messages on topics that were approved here.
 */
export async function registerRealtimeAuthorizeRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  app.post(
    "/realtime/authorize",
    {
      schema: {
        tags: ["realtime"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("RealtimeAuthorizeBody", realtimeAuthorizeSchema),
        response: {
          200: {
            type: "object",
            properties: {
              allowedTopics: { type: "array", items: { type: "string" } },
            },
            required: ["allowedTopics"],
          },
        },
      },
    },
    async (request) => {
      const ctx = request.netram!;
      const { topics } = request.body as { topics: string[] };
      const allowed = topics.filter((t) => ctx.permissions.has(topicPermission(t)));
      void container;
      return { allowedTopics: allowed };
    },
  );
}
