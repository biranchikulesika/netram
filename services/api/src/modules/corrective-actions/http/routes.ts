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
  reviewCorrectiveActionSchema,
} from "@netram/validation";
import type { CorrectiveActionListQuery } from "@netram/types";

export async function registerCorrectiveActionRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const correctiveActionService = container.correctiveActionService;
  const paramsSchema = toJsonSchema("CorrectiveActionIdParams", idParamsSchema);
  const atrFileParamsSchema = toJsonSchema(
    "CorrectiveActionFileIdParams",
    idParamsSchema.extend({ fileId: idParamsSchema.shape.id }),
  );

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
    "/corrective-actions/:id/submit-atr",
    {
      schema: {
        tags: ["corrective-actions"],
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        params: paramsSchema,        response: {
          200: toJsonSchema("CorrectiveAction", correctiveActionSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      let actionSummary = "";
      const files: { data: Buffer; fileName: string; mimeType: string }[] = [];
      for await (const part of request.parts()) {
        if (part.type === "file") {
          const data = await part.toBuffer();
          files.push({ data, fileName: part.filename || "attachment", mimeType: part.mimetype || "application/octet-stream" });
        } else if (part.fieldname === "actionSummary" && typeof part.value === "string") {
          actionSummary = part.value;
        }
      }
      const body = { actionSummary, files };
      return correctiveActionService.submitAtr(request.netram!, id, body);
    },
  );

  app.get(
    "/corrective-actions/:id/files/:fileId",
    {
      schema: {
        tags: ["corrective-actions"],
        security: [{ bearerAuth: [] }],
        params: atrFileParamsSchema,
        response: {
          200: { type: "string", format: "binary" },
        },
      },
    },
    async (request, reply) => {
      const { id, fileId } = request.params as { id: string; fileId: string };
      const { file, stream } = await correctiveActionService.getAtrFileContent(
        request.netram!,
        id,
        fileId,
      );
      reply.header("content-type", file.mimeType ?? "application/octet-stream");
      if (file.sizeBytes !== null) reply.header("content-length", String(file.sizeBytes));
      void reply.header("x-netram-attachment-id", file.id);
      void reply.header(
        "content-disposition",
        `inline; filename="${encodeURIComponent(file.fileName)}"`,
      );
      return reply.send(stream);
    },
  );

  app.post(
    "/corrective-actions/:id/review",
    {
      schema: {
        tags: ["corrective-actions"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("ReviewCorrectiveActionBody", reviewCorrectiveActionSchema),
        response: {
          200: toJsonSchema("CorrectiveAction", correctiveActionSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof reviewCorrectiveActionSchema>;
      return correctiveActionService.reviewAction(request.netram!, id, body);
    },
  );
}
