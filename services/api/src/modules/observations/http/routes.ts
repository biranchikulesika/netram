import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import { createObservationSchema, idParamsSchema, observationListSchema } from "@netram/validation";

export async function registerObservationRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const observationService = container.observationService;
  const paramsSchema = toJsonSchema("InspectionIdParams", idParamsSchema);

  app.get(
    "/inspections/:id/observations",
    {
      schema: {
        tags: ["observations"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: toJsonSchema("ObservationList", observationListSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return observationService.listObservations(request.netram!, id);
    },
  );

  app.post(
    "/inspections/:id/observations",
    {
      schema: {
        tags: ["observations"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("CreateObservationBody", createObservationSchema),
        response: {
          201: toJsonSchema("Observation", observationListSchema.element),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof createObservationSchema>;
      const observation = await observationService.createObservation(request.netram!, id, body);
      void reply.code(201);
      return observation;
    },
  );
}
