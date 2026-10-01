import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  idParamsSchema,
  createRiskRuleSchema,
  patchRiskRuleSchema,
  assignFlagSchema,
  reviewFlagSchema,
  resolveFlagSchema,
  dismissFlagSchema,
  inspectionFlagListQuerySchema,
} from "@netram/validation";
import type { InspectionFlagListQuery } from "@netram/types";

export async function registerFinancialRiskRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const riskService = container.financialRiskService;
  const paramsSchema = toJsonSchema("IdParams", idParamsSchema);

  // Evaluate risk for a project
  app.post(
    "/financial-risk/evaluate/:id",
    {
      schema: {
        tags: ["financial-risk"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return riskService.evaluateProject(request.netram!, id);
    },
  );

  // List rules
  app.get(
    "/financial-risk/rules",
    {
      schema: {
        tags: ["financial-risk"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          "ListRulesQuery",
          z.object({ enabledOnly: z.coerce.boolean().optional() }),
        ),
      },
    },
    async (request) => {
      const query = request.query as { enabledOnly?: boolean };
      return riskService.listRules(request.netram!, query.enabledOnly);
    },
  );

  // Get rule by ID
  app.get(
    "/financial-risk/rules/:id",
    {
      schema: {
        tags: ["financial-risk"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return riskService.getRule(request.netram!, id);
    },
  );

  // Create rule
  app.post(
    "/financial-risk/rules",
    {
      schema: {
        tags: ["financial-risk"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateRiskRuleBody", createRiskRuleSchema),
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createRiskRuleSchema>;
      const rule = await riskService.createRule(request.netram!, body);
      void reply.code(201);
      return rule;
    },
  );

  // Update rule
  app.patch(
    "/financial-risk/rules/:id",
    {
      schema: {
        tags: ["financial-risk"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("PatchRiskRuleBody", patchRiskRuleSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof patchRiskRuleSchema>;
      return riskService.updateRule(request.netram!, id, body);
    },
  );

  // List events for a project
  app.get(
    "/financial-risk/events",
    {
      schema: {
        tags: ["financial-risk"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ProjectEventsQuery", z.object({ projectId: z.string().uuid() })),
      },
    },
    async (request) => {
      const { projectId } = request.query as { projectId: string };
      return riskService.listEventsByProject(request.netram!, projectId);
    },
  );

  /* ---------- Inspection Flags ---------- */

  // List flags
  app.get(
    "/inspection-flags",
    {
      schema: {
        tags: ["inspection-flags"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("InspectionFlagListQuery", inspectionFlagListQuerySchema),
      },
    },
    async (request) => {
      const query = request.query as unknown as InspectionFlagListQuery;
      return riskService.listFlags(request.netram!, query);
    },
  );

  // Get flag by ID
  app.get(
    "/inspection-flags/:id",
    {
      schema: {
        tags: ["inspection-flags"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return riskService.getFlag(request.netram!, id);
    },
  );

  // Assign inspector to flag
  app.post(
    "/inspection-flags/:id/assign",
    {
      schema: {
        tags: ["inspection-flags"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("AssignFlagBody", assignFlagSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof assignFlagSchema>;
      return riskService.assignFlag(request.netram!, id, body.assignedInspectorId);
    },
  );

  // Launch inspection from flag
  app.post(
    "/inspection-flags/:id/create-inspection",
    {
      schema: {
        tags: ["inspection-flags"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema(
          "CreateInspectionFromFlagBody",
          z.object({
            templateId: z.string().uuid().optional(),
            scheduledStart: z.string().datetime().optional(),
            scheduledEnd: z.string().datetime().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        templateId?: string;
        scheduledStart?: string;
        scheduledEnd?: string;
      };
      const result = await riskService.createInspectionFromFlag(request.netram!, id, body);
      void reply.code(201);
      return result;
    },
  );

  // Review notes on flag
  app.post(
    "/inspection-flags/:id/review",
    {
      schema: {
        tags: ["inspection-flags"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("ReviewFlagBody", reviewFlagSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof reviewFlagSchema>;
      return riskService.reviewFlag(request.netram!, id, body.reviewNotes, body.status);
    },
  );

  // Resolve flag
  app.post(
    "/inspection-flags/:id/resolve",
    {
      schema: {
        tags: ["inspection-flags"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("ResolveFlagBody", resolveFlagSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof resolveFlagSchema>;
      return riskService.resolveFlag(request.netram!, id, body.resolution);
    },
  );

  // Dismiss flag
  app.post(
    "/inspection-flags/:id/dismiss",
    {
      schema: {
        tags: ["inspection-flags"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("DismissFlagBody", dismissFlagSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof dismissFlagSchema>;
      return riskService.dismissFlag(request.netram!, id, body.dismissedReason);
    },
  );
}
