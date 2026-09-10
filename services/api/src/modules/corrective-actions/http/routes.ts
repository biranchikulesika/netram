import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  correctiveActionListQuerySchema,
  correctiveActionPageSchema,
  correctiveActionSchema,
  createCorrectiveActionSchema,
  idParamsSchema,
  transitionCorrectiveActionSchema,
} from "@netram/validation";
import type { CorrectiveActionListQuery, CorrectiveActionStatus } from "@netram/types";

export async function registerCorrectiveActionRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const correctiveActionService = container.correctiveActionService;
  const paramsSchema = toJsonSchema("CorrectiveActionIdParams", idParamsSchema);

  app.get(
    "/corrective-actions",
    {
      schema: {
        tags: ["corrective-actions"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("CorrectiveActionListQuery", correctiveActionListQuerySchema),
        response: {
          200: toJsonSchema("CorrectiveActionPage", correctiveActionPageSchema),
        },
      },
    },
    async (request) => {
      const q = request.query as unknown as CorrectiveActionListQuery;
      return correctiveActionService.listCorrectiveActions(request.netram!, q);
    },
  );

  app.post(
    "/corrective-actions",
    {
      schema: {
        tags: ["corrective-actions"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateCorrectiveActionBody", createCorrectiveActionSchema),
        response: {
          201: toJsonSchema("CorrectiveAction", correctiveActionSchema),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createCorrectiveActionSchema>;
      const action = await correctiveActionService.createCorrectiveAction(request.netram!, body);
      void reply.code(201);
      return action;
    },
  );

  app.get(
    "/corrective-actions/:id",
    {
      schema: {
        tags: ["corrective-actions"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: toJsonSchema("CorrectiveAction", correctiveActionSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return correctiveActionService.getCorrectiveAction(request.netram!, id);
    },
  );

  app.post(
    "/corrective-actions/:id/transitions",
    {
      schema: {
        tags: ["corrective-actions"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("TransitionCorrectiveActionBody", transitionCorrectiveActionSchema),
        response: {
          200: toJsonSchema("CorrectiveAction", correctiveActionSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        to: CorrectiveActionStatus;
        note?: string;
      };
      return correctiveActionService.transitionCorrectiveAction(
        request.netram!,
        id,
        body.to,
        body.note,
      );
    },
  );
}
