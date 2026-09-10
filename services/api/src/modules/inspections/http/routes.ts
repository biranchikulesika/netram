import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  createInspectionSchema,
  idParamsSchema,
  inspectionListQuerySchema,
  inspectionPageSchema,
  inspectionSchema,
  outboxEventListSchema,
  transitionInspectionSchema,
  syncBatchRequestSchema,
} from "@netram/validation";
import type { InspectionListQuery, InspectionStatus, SyncBatchRequest } from "@netram/types";

export async function registerInspectionRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const inspectionService = container.inspectionService;
  const paramsSchema = toJsonSchema("InspectionIdParams", idParamsSchema);

  app.get(
    "/inspections",
    {
      schema: {
        tags: ["inspections"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("InspectionListQuery", inspectionListQuerySchema),
        response: { 200: toJsonSchema("InspectionPage", inspectionPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as InspectionListQuery;
      return inspectionService.listInspections(request.netram!, q);
    },
  );

  app.get(
    "/inspections/:id",
    {
      schema: {
        tags: ["inspections"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("Inspection", inspectionSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return inspectionService.getInspection(request.netram!, id);
    },
  );

  app.get(
    "/inspections/:id/events",
    {
      schema: {
        tags: ["inspections"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: toJsonSchema("InspectionEventList", outboxEventListSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return inspectionService.listInspectionEvents(request.netram!, id);
    },
  );

  app.post(
    "/inspections",
    {
      schema: {
        tags: ["inspections"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateInspectionBody", createInspectionSchema),
        response: { 201: toJsonSchema("Inspection", inspectionSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createInspectionSchema>;
      const inspection = await inspectionService.createInspection(request.netram!, body);
      void reply.code(201);
      return inspection;
    },
  );

  app.post(
    "/inspections/:id/transitions",
    {
      schema: {
        tags: ["inspections"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("TransitionInspectionBody", transitionInspectionSchema),
        response: { 200: toJsonSchema("Inspection", inspectionSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { to: InspectionStatus; note?: string };
      return inspectionService.transitionInspection(request.netram!, id, body.to, body.note);
    },
  );

  app.post(
    "/inspections/sync",
    {
      schema: {
        tags: ["inspections"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("SyncBatchRequestBody", syncBatchRequestSchema),
      },
    },
    async (request) => {
      const body = request.body as SyncBatchRequest;
      return container.inspectionSyncService.syncBatch(request.netram!, body);
    },
  );
}
