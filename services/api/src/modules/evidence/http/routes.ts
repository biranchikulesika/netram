import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  captureEvidenceSchema,
  evidenceListSchema,
  idParamsSchema,
  verifyEvidenceIntegritySchema,
} from "@netram/validation";

export async function registerEvidenceRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const evidenceService = container.evidenceService;
  const inspectionParamsSchema = toJsonSchema("InspectionIdParams", idParamsSchema);
  const evidenceParamsSchema = toJsonSchema("EvidenceIdParams", idParamsSchema);

  app.get(
    "/inspections/:id/evidence",
    {
      schema: {
        tags: ["evidence"],
        security: [{ bearerAuth: [] }],
        params: inspectionParamsSchema,
        response: { 200: toJsonSchema("EvidenceList", evidenceListSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return evidenceService.listEvidence(request.netram!, id);
    },
  );

  app.post(
    "/inspections/:id/evidence",
    {
      schema: {
        tags: ["evidence"],
        security: [{ bearerAuth: [] }],
        params: inspectionParamsSchema,
        body: toJsonSchema("CaptureEvidenceBody", captureEvidenceSchema),
        response: { 201: toJsonSchema("Evidence", evidenceListSchema.element) },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof captureEvidenceSchema>;
      const evidence = await evidenceService.captureEvidence(request.netram!, id, body);
      void reply.code(201);
      return evidence;
    },
  );

  app.post(
    "/evidence/:id/uploads",
    {
      schema: {
        tags: ["evidence"],
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        params: evidenceParamsSchema,
        response: { 200: toJsonSchema("Evidence", evidenceListSchema.element) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const file = await request.file();
      if (!file) throw new Error("Multipart upload requires a file part.");
      const data = await file.toBuffer();
      return evidenceService.uploadEvidence(request.netram!, id, {
        data,
        fileName: file.filename || null,
        mimeType: file.mimetype || null,
      });
    },
  );

  app.get(
    "/evidence/:id/content",
    {
      schema: {
        tags: ["evidence"],
        security: [{ bearerAuth: [] }],
        params: evidenceParamsSchema,
        response: {
          200: { type: "string", format: "binary" },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { evidence, stream } = await evidenceService.getEvidenceContent(request.netram!, id);
      reply.header("content-type", evidence.mimeType ?? "application/octet-stream");
      if (evidence.sizeBytes !== null) reply.header("content-length", String(evidence.sizeBytes));
      void reply.header("x-netram-evidence-id", evidence.id);
      return reply.send(stream);
    },
  );

  app.post(
    "/evidence/:id/integrity-check",
    {
      schema: {
        tags: ["evidence"],
        security: [{ bearerAuth: [] }],
        params: evidenceParamsSchema,
        body: toJsonSchema("VerifyEvidenceIntegrityBody", verifyEvidenceIntegritySchema),
        response: { 200: toJsonSchema("Evidence", evidenceListSchema.element) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { contentHash: string };
      return evidenceService.verifyIntegrity(request.netram!, id, body.contentHash);
    },
  );
}
