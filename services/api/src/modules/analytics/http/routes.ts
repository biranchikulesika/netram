import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import { analyticsQuerySchema } from "@netram/validation";
import type { AnalyticsQuery } from "@netram/types";

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const analyticsService = container.analyticsService;

  app.get(
    "/analytics/overview",
    {
      schema: {
        tags: ["analytics"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AnalyticsQuery", analyticsQuerySchema),
      },
    },
    async (request) => {
      const q = (request.query ?? {}) as AnalyticsQuery;
      return analyticsService.getOverview(request.netram!, q);
    },
  );
}
