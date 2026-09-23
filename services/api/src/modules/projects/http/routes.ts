import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  createProjectSchema,
  updateProjectSchema,
  idParamsSchema,
  projectListQuerySchema,
  projectPageSchema,
  projectSchema,
  projectGeofenceSchema,
  sealGeofenceSchema,
  transitionProjectSchema,
  projectPhotoListSchema,
  projectPhotoSchema,
  uploadProjectPhotoSchema,
  publicProjectRegistrySchema,
} from "@netram/validation";
import { z } from "zod";
import { AppError } from "../../../infrastructure/errors.js";
import type { ProjectListQuery, ProjectStatus } from "@netram/types";

type MultipartFieldValue = unknown;

function multipartStringValue(value: MultipartFieldValue): string | undefined {
  if (value && typeof value === "object" && "value" in value) {
    const v = (value as { value: unknown }).value;
    return typeof v === "string" ? v : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function readMultipartFields(fields: Record<string, MultipartFieldValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const s = Array.isArray(value)
      ? (value.map(multipartStringValue).find((x) => x !== undefined) ?? undefined)
      : multipartStringValue(value);
    if (s !== undefined) out[key] = s;
  }
  return out;
}

export async function registerProjectRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const projectService = container.projectService;
  const projectPhotoService = container.projectPhotoService;
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

  // Registrations awaiting an authority verification decision. Registered
  // BEFORE "/projects/:id" so Fastify does not treat "verification-queue"
  // as an :id.
  app.get(
    "/projects/verification-queue",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("ProjectPage", projectPageSchema) },
      },
    },
    async (request) => projectService.listVerificationQueue(request.netram!),
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
    "/projects/registry",
    {
      config: { public: true },
      schema: {
        tags: ["projects"],
        response: { 200: toJsonSchema("PublicProjectRegistry", publicProjectRegistrySchema) },
      },
    },
    async () => projectService.listPublicRegistry(),
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
        response: {
          200: toJsonSchema("ProjectGeofenceNullable", projectGeofenceSchema.nullable()),
        },
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

  app.patch(
    "/projects/:id",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("UpdateProjectBody", updateProjectSchema),
        response: { 200: toJsonSchema("Project", projectSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateProjectSchema>;
      return projectService.updateProject(request.netram!, id, body);
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

  app.get(
    "/projects/:id/photos",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("ProjectPhotoList", projectPhotoListSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return projectPhotoService.listPhotos(request.netram!, id);
    },
  );

  app.post(
    "/projects/:id/photos",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        params: paramsSchema,
        response: { 201: toJsonSchema("ProjectPhoto", projectPhotoSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const file = await request.file();
      if (!file) throw AppError.badRequest("Multipart upload requires a file part.");
      const data = await file.toBuffer();

      const parsed = uploadProjectPhotoSchema.safeParse(readMultipartFields(file.fields));
      if (!parsed.success) {
        throw AppError.badRequest("Invalid project photo metadata.");
      }

      const photo = await projectPhotoService.uploadPhoto(request.netram!, id, {
        data,
        capturedAt: parsed.data.capturedAt,
        caption: parsed.data.caption,
        fileName: file.filename ?? undefined,
        mimeType: file.mimetype ?? undefined,
      });
      return photo;
    },
  );

  app.get(
    "/projects/photos/:id/content",
    {
      schema: {
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema("ProjectPhotoIdParams", idParamsSchema),
        response: {
          200: { type: "string", format: "binary" },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { photo, stream } = await projectPhotoService.getPhotoContent(request.netram!, id);
      reply.header("content-type", photo.mimeType ?? "application/octet-stream");
      if (photo.sizeBytes !== null) reply.header("content-length", String(photo.sizeBytes));
      return reply.send(stream);
    },
  );
}
