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
  const trackingParamsSchema = toJsonSchema(
    "TrackingCodeParams",
    z.object({ trackingCode: z.string().min(3).max(50) }),
  );

  // Citizen/Public Tracking Lookup (§35)
  app.get(
    "/complaints/track/:trackingCode",
    {
      schema: {
        tags: ["complaints"],
        params: trackingParamsSchema,
        response: { 200: toJsonSchema("Complaint", complaintSchema) },
      },
    },
    async (request) => {
      const { trackingCode } = request.params as { trackingCode: string };
      return complaintService.trackComplaint(trackingCode);
    },
  );

  // Citizen/Public Intake (§35)
  app.post(
    "/complaints/public",
    {
      schema: {
        tags: ["complaints"],
        body: toJsonSchema("CreateComplaintBody", createComplaintSchema),
        response: { 201: toJsonSchema("Complaint", complaintSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createComplaintSchema>;
      const complaint = await complaintService.submitPublicComplaint(body, {
        requestId: request.id,
        ipAddress: request.ip,
      });
      void reply.code(201);
      return complaint;
    },
  );

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
