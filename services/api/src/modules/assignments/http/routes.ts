import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  assignmentListQuerySchema,
  assignmentPageSchema,
  createAssignmentSchema,
  idParamsSchema,
  inspectionAssignmentSchema,
} from "@netram/validation";
import type { AssignmentListQuery } from "@netram/types";

export async function registerAssignmentRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const assignmentService = container.inspectionAssignmentService;
  const paramsSchema = toJsonSchema("IdParams", idParamsSchema);

  app.get(
    "/inspections/:id/assignments",
    {
      schema: {
        tags: ["assignments"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: {
            type: "array",
            items: toJsonSchema("InspectionAssignment", inspectionAssignmentSchema),
          },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return assignmentService.listAssignments(request.netram!, id);
    },
  );

  app.post(
    "/inspections/:id/assignments",
    {
      schema: {
        tags: ["assignments"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("CreateAssignmentBody", createAssignmentSchema),
        response: {
          201: toJsonSchema("InspectionAssignment", inspectionAssignmentSchema),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof createAssignmentSchema>;
      const assignment = await assignmentService.assignInspector(
        request.netram!,
        id,
        body.userId,
        body.role,
      );
      void reply.code(201);
      return assignment;
    },
  );

  app.get(
    "/assignments/mine",
    {
      schema: {
        tags: ["assignments"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AssignmentListQuery", assignmentListQuerySchema),
        response: { 200: toJsonSchema("AssignmentPage", assignmentPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as AssignmentListQuery;
      const page = await assignmentService.listMine(request.netram!, q.page ?? 1, q.pageSize ?? 20);
      return { ...page, page: q.page ?? 1, pageSize: q.pageSize ?? 20 };
    },
  );

  app.delete(
    "/assignments/:id",
    {
      schema: {
        tags: ["assignments"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 204: { type: "null" } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assignmentService.removeAssignment(request.netram!, id);
      void reply.code(204);
      return null;
    },
  );
}
