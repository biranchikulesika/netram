import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  createProjectSchema,
  idParamsSchema,
  projectListQuerySchema,
  projectPageSchema,
  projectSchema,
  transitionProjectSchema,
} from "@netram/validation";
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
