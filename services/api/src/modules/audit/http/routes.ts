import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import { auditListQuerySchema, auditPageSchema } from "@netram/validation";
import type { AuditListQuery } from "@netram/types";

export async function registerAuditRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const auditService = container.auditService;

  app.get(
    "/audit-events",
    {
      schema: {
        tags: ["audit"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AuditListQuery", auditListQuerySchema),
        response: { 200: toJsonSchema("AuditPage", auditPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as AuditListQuery;
      return auditService.listAuditEvents(request.netram!, q);
    },
  );
}
