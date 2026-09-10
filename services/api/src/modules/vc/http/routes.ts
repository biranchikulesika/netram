import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  idParamsSchema,
  createVcSessionSchema,
  listVcSessionsQuerySchema,
  joinVcSessionSchema,
  vcSessionWithParticipantsSchema,
  vcSessionPageSchema,
  vcJoinDetailsSchema,
} from "@netram/validation";
import type {
  CreateVcSessionInput,
  ListVcSessionsQuery,
  JoinVcSessionInput,
} from "@netram/validation";

export async function registerVcRoutes(app: FastifyInstance, container: Container): Promise<void> {
  const vcService = container.vcService;
  const paramsSchema = toJsonSchema("VcSessionIdParams", idParamsSchema);

  // Create/schedule VC session
  app.post(
    "/vc/sessions",
    {
      schema: {
        tags: ["vc"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateVcSessionInput", createVcSessionSchema),
        response: {
          201: toJsonSchema("VcSessionWithParticipants", vcSessionWithParticipantsSchema),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateVcSessionInput;
      const session = await vcService.createSession(request.netram!, body);
      return reply.code(201).send(session);
    },
  );

  // List VC sessions
  app.get(
    "/vc/sessions",
    {
      schema: {
        tags: ["vc"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ListVcSessionsQuery", listVcSessionsQuerySchema),
        response: { 200: toJsonSchema("VcSessionPage", vcSessionPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as ListVcSessionsQuery;
      return vcService.listSessions(request.netram!, q);
    },
  );

  // Get VC session by ID
  app.get(
    "/vc/sessions/:id",
    {
      schema: {
        tags: ["vc"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: toJsonSchema("VcSessionWithParticipants", vcSessionWithParticipantsSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return vcService.getSession(request.netram!, id);
    },
  );

  // Start VC session
  app.post(
    "/vc/sessions/:id/start",
    {
      schema: {
        tags: ["vc"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: toJsonSchema("VcSessionWithParticipants", vcSessionWithParticipantsSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return vcService.startSession(request.netram!, id);
    },
  );

  // End VC session
  app.post(
    "/vc/sessions/:id/end",
    {
      schema: {
        tags: ["vc"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: toJsonSchema("VcSessionWithParticipants", vcSessionWithParticipantsSchema),
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return vcService.endSession(request.netram!, id);
    },
  );

  // Join VC session
  app.post(
    "/vc/sessions/:id/join",
    {
      schema: {
        tags: ["vc"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("JoinVcSessionInput", joinVcSessionSchema),
        response: { 200: toJsonSchema("VcJoinDetails", vcJoinDetailsSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = (request.body as JoinVcSessionInput | undefined) ?? {};
      return vcService.joinSession(request.netram!, id, body.role);
    },
  );

  // Leave VC session
  app.post(
    "/vc/sessions/:id/leave",
    {
      schema: {
        tags: ["vc"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await vcService.leaveSession(request.netram!, id);
      return reply.code(204).send();
    },
  );
}
