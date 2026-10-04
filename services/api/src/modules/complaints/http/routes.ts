import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  complaintListQuerySchema,
  complaintPageSchema,
  complaintSchema,
  createComplaintSchema,
  idParamsSchema,
  publicComplaintTrackingSchema,
  transitionComplaintSchema,
} from "@netram/validation";
import type { ComplaintListQuery, ComplaintStatus } from "@netram/types";

export async function registerComplaintRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const complaintService = container.complaintService;
  const paramsSchema = toJsonSchema("ComplaintIdParams", idParamsSchema);

  app.get(
    "/complaints",
    {
      schema: {
        tags: ["complaints"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ComplaintListQuery", complaintListQuerySchema),
        response: { 200: toJsonSchema("ComplaintPage", complaintPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as ComplaintListQuery;
      return complaintService.listComplaints(request.netram!, q);
    },
  );

  app.post(
    "/complaints",
    {
      schema: {
        tags: ["complaints"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateComplaintBody", createComplaintSchema),
        response: { 201: toJsonSchema("Complaint", complaintSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createComplaintSchema>;
      const complaint = await complaintService.createComplaint(request.netram!, body);
      void reply.code(201);
      return complaint;
    },
  );

  app.post(
    "/complaints/register",
    {
      config: { public: true },
      schema: {
        tags: ["complaints"],
        consumes: ["multipart/form-data"],
        response: { 201: toJsonSchema("Complaint", complaintSchema) },
      },
    },
    async (request, reply) => {
      let projectId = "";
      let description = "";
      let complainantName: string | undefined;
      let contactInfo: string | undefined;
      const files: { data: Buffer; fileName: string; mimeType: string }[] = [];

      for await (const part of request.parts()) {
        if (part.type === "file") {
          const data = await part.toBuffer();
          files.push({
            data,
            fileName: part.filename || "attachment",
            mimeType: part.mimetype || "application/octet-stream",
          });
        } else if (part.fieldname === "projectId" && typeof part.value === "string") {
          projectId = part.value;
        } else if (part.fieldname === "description" && typeof part.value === "string") {
          description = part.value;
        } else if (part.fieldname === "complainantName" && typeof part.value === "string") {
          complainantName = part.value;
        } else if (part.fieldname === "contactInfo" && typeof part.value === "string") {
          contactInfo = part.value;
        }
      }

      const body = createComplaintSchema.parse({
        projectId,
        description,
        complainantName,
        contactInfo,
      });
      const complaint = await complaintService.createPublicComplaint(
        body,
        files,
        request.id,
        request.ip ?? "unknown",
      );
      void reply.code(201);
      return complaint;
    },
  );

  app.get(
    "/complaints/:id/files/:fileId",
    {
      schema: {
        tags: ["complaints"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(
          "ComplaintFileIdParams",
          idParamsSchema.extend({ fileId: idParamsSchema.shape.id }),
        ),
        response: { 200: { type: "string", format: "binary" } },
      },
    },
    async (request, reply) => {
      const { id, fileId } = request.params as { id: string; fileId: string };
      const { file, stream } = await complaintService.getComplaintFileContent(
        request.netram!,
        id,
        fileId,
      );
      reply.header("content-type", file.mimeType ?? "application/octet-stream");
      reply.header("content-length", String(file.sizeBytes));
      void reply.header("x-netram-attachment-id", file.id);
      void reply.header(
        "content-disposition",
        `inline; filename="${encodeURIComponent(file.fileName)}"`,
      );
      return reply.send(stream);
    },
  );

  app.get(
    "/complaints/:id",
    {
      schema: {
        tags: ["complaints"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("Complaint", complaintSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return complaintService.getComplaint(request.netram!, id);
    },
  );

  app.post(
    "/complaints/:id/transitions",
    {
      schema: {
        tags: ["complaints"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("TransitionComplaintBody", transitionComplaintSchema),
        response: { 200: toJsonSchema("Complaint", complaintSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        to: ComplaintStatus;
        resolutionText?: string;
      };
      return complaintService.transitionComplaint(
        request.netram!,
        id,
        body.to,
        body.resolutionText,
      );
    },
  );

  app.get(
    "/complaints/track/:trackingCode",
    {
      config: { public: true },
      schema: {
        tags: ["complaints"],
        params: toJsonSchema(
          "TrackComplaintParams",
          z.object({ trackingCode: z.string().min(1).max(50) }),
        ),
        response: {
          200: toJsonSchema("PublicComplaintTracking", publicComplaintTrackingSchema),
        },
      },
    },
    async (request) => {
      const { trackingCode } = request.params as { trackingCode: string };
      return complaintService.trackComplaint(trackingCode);
    },
  );
}
