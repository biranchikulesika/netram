import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  createProjectSchema,
  idParamsSchema,
  projectListQuerySchema,
  projectPageSchema,
  projectSchema,
  projectGeofenceSchema,
  sealGeofenceSchema,
  transitionProjectSchema,
} from "@netram/validation";
import { z } from "zod";
import type { ProjectListQuery, ProjectStatus } from "@netram/types";

export async function registerProjectRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const projectService = container.projectService;
  const paramsSchema = toJsonSchema("ProjectIdParams", idParamsSchema);

  app.get(
    "/projects",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ProjectListQuery", projectListQuerySchema),
        response: { 200: toJsonSchema("ProjectPage", projectPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as ProjectListQuery;
      return projectService.listProjects(request.netram!, q);
    },
  );

  app.get(
    "/projects/geofences",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("ProjectGeofenceList", z.array(projectGeofenceSchema)) },
      },
    },
    async (request) => {
      return projectService.listGeofences(request.netram!);
    },
  );

  app.get(
    "/projects/:id",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("Project", projectSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return projectService.getProject(request.netram!, id);
    },
  );

  app.get(
    "/projects/:id/geofence",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("ProjectGeofenceNullable", projectGeofenceSchema.nullable()) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return projectService.getGeofence(request.netram!, id);
    },
  );

  app.post(
    "/projects/:id/geofence",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("SealGeofenceBody", sealGeofenceSchema),
        response: { 200: toJsonSchema("ProjectGeofence", projectGeofenceSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof sealGeofenceSchema>;
      return projectService.sealGeofence(request.netram!, id, body);
    },
  );

  app.post(
    "/projects",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateProjectBody", createProjectSchema),
        response: { 201: toJsonSchema("Project", projectSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createProjectSchema>;
      const project = await projectService.createProject(request.netram!, body);
      void reply.code(201);
      return project;
    },
  );

  app.post(
    "/projects/:id/transitions",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("TransitionProjectBody", transitionProjectSchema),
        response: { 200: toJsonSchema("Project", projectSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { to: ProjectStatus; note?: string };
      return projectService.transitionProject(request.netram!, id, body.to, body.note);
    },
  );
}
