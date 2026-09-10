import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  createFindingSchema,
  findingListSchema,
  idParamsSchema,
  transitionFindingSchema,
} from "@netram/validation";
import type { FindingStatus } from "@netram/types";

export async function registerFindingRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const findingService = container.findingService;
  const paramsSchema = toJsonSchema("InspectionIdParams", idParamsSchema);

  app.get(
    "/inspections/:id/findings",
    {
      schema: {
        tags: ["findings"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("FindingList", findingListSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return findingService.listFindings(request.netram!, id);
    },
  );

  app.post(
    "/inspections/:id/findings",
    {
      schema: {
        tags: ["findings"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("CreateFindingBody", createFindingSchema),
        response: { 201: toJsonSchema("Finding", findingListSchema.element) },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof createFindingSchema>;
      const finding = await findingService.createFinding(request.netram!, id, body);
      void reply.code(201);
      return finding;
    },
  );

  // Re-uses the same params name so OpenAPI stays small; path uniquely identifies it.
  app.post(
    "/findings/:id/transitions",
    {
      schema: {
        tags: ["findings"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema("FindingIdParams", idParamsSchema),
        body: toJsonSchema("TransitionFindingBody", transitionFindingSchema),
        response: { 200: toJsonSchema("Finding", findingListSchema.element) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { to: FindingStatus; note?: string };
      return findingService.transitionFinding(request.netram!, id, body.to, body.note);
    },
  );
}
