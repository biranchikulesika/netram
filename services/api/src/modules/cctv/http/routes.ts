import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  idParamsSchema,
  listCamerasQuerySchema,
  cctvCameraPageSchema,
  publicCctvCameraSchema,
  cameraHealthStatusSchema,
  requestStreamSchema,
  authorizedStreamSchema,
} from "@netram/validation";
import type { ListCamerasQuery } from "@netram/validation";

export async function registerCctvRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const cctvService = container.cctvService;
  const paramsSchema = toJsonSchema("CctvCameraIdParams", idParamsSchema);

  // List CCTV cameras (omits raw credentials and endpoints)
  app.get(
    "/cctv/cameras",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ListCamerasQuery", listCamerasQuerySchema),
        response: { 200: toJsonSchema("CctvCameraPage", cctvCameraPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as ListCamerasQuery;
      return cctvService.listCameras(request.netram!, q);
    },
  );

  // Get CCTV camera details
  app.get(
    "/cctv/cameras/:id",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("PublicCctvCamera", publicCctvCameraSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return cctvService.getCamera(request.netram!, id);
    },
  );

  // Live camera health check via CCTV Gateway
  app.get(
    "/cctv/cameras/:id/health",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("CameraHealthStatus", cameraHealthStatusSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return cctvService.getCameraHealth(request.netram!, id);
    },
  );

  // Request authorized stream relay token
  app.post(
    "/cctv/cameras/:id/streams",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("RequestStreamInput", requestStreamSchema),
        response: { 201: toJsonSchema("AuthorizedStream", authorizedStreamSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as { ttlSeconds?: number } | undefined) ?? {};
      const result = await cctvService.requestCameraStream(request.netram!, id, body);
      return reply.code(201).send(result);
    },
  );

  // Snapshot frame for advisory AI anomaly detection / inspection verification (§7, §36)
  app.get(
    "/cctv/cameras/:id/snapshot",
    {
      schema: {
        tags: ["cctv"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const snapshot = await cctvService.getCameraSnapshot(request.netram!, id);
      void reply.header("Content-Type", snapshot.contentType);
      void reply.header("Content-Length", snapshot.data.length);
      return reply.send(snapshot.data);
    },
  );
}
