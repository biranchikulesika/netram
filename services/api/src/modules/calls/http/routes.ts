import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import { z } from "zod";
import {
  callContactSchema,
  callRecordSchema,
  createCallRecordSchema,
  listCallHistoryQuerySchema,
} from "@netram/validation";
import type {
  CreateCallRecordInput,
  ListCallHistoryQuery,
} from "@netram/validation";

export async function registerCallRoutes(app: FastifyInstance, container: Container): Promise<void> {
  const callService = container.callService;

  // List call contacts
  app.get(
    "/calls/contacts",
    {
      schema: {
        tags: ["calls"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("CallContactList", z.array(callContactSchema)) },
      },
    },
    async (request) => {
      return callService.listContacts(request.netram);
    },
  );

  // List call history
  app.get(
    "/calls/history",
    {
      schema: {
        tags: ["calls"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ListCallHistoryQuery", listCallHistoryQuerySchema),
        response: { 200: toJsonSchema("CallRecordList", z.array(callRecordSchema)) },
      },
    },
    async (request) => {
      const q = request.query as unknown as ListCallHistoryQuery;
      return callService.listCallHistory(request.netram, q);
    },
  );

  // Record call history
  app.post(
    "/calls/history",
    {
      schema: {
        tags: ["calls"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateCallRecordInput", createCallRecordSchema),
        response: { 201: toJsonSchema("CallRecord", callRecordSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateCallRecordInput;
      const record = await callService.createCallRecord(request.netram, body);
      return reply.code(201).send(record);
    },
  );
}
