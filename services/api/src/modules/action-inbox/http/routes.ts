import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import { actionInboxResponseSchema } from "@netram/validation";

export async function registerActionInboxRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const actionInboxService = container.actionInboxService;

  app.get(
    "/action-inbox",
    {
      schema: {
        tags: ["action-inbox"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("ActionInboxResponse", actionInboxResponseSchema) },
      },
    },
    async (request) => actionInboxService.list(request.netram!),
  );
}
