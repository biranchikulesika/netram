import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  aiAnomalyListQuerySchema,
  aiAnomalyPageSchema,
  aiAnomalySchema,
  idParamsSchema,
  transitionAiAnomalySchema,
} from "@netram/validation";
import type { AIAnomalyListQuery, AnomalyStatus } from "@netram/types";

export async function registerAiAnomalyRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const aiAnomalyService = container.aiAnomalyService;
  const paramsSchema = toJsonSchema("AiAnomalyIdParams", idParamsSchema);

  app.get(
    "/ai-anomalies",
    {
      schema: {
        tags: ["ai-anomalies"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AiAnomalyListQuery", aiAnomalyListQuerySchema),
        response: { 200: toJsonSchema("AiAnomalyPage", aiAnomalyPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as AIAnomalyListQuery;
      return aiAnomalyService.listAiAnomalies(request.netram!, q);
    },
  );

  app.get(
    "/ai-anomalies/:id",
    {
      schema: {
        tags: ["ai-anomalies"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("AiAnomaly", aiAnomalySchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return aiAnomalyService.getAiAnomaly(request.netram!, id);
    },
  );

  app.post(
    "/ai-anomalies/:id/transitions",
    {
      schema: {
        tags: ["ai-anomalies"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("TransitionAiAnomalyBody", transitionAiAnomalySchema),
        response: { 200: toJsonSchema("AiAnomaly", aiAnomalySchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { to: AnomalyStatus };
      return aiAnomalyService.transitionAiAnomaly(request.netram!, id, body.to);
    },
  );
}
