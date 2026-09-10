import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  idParamsSchema,
  notificationListResponseSchema,
  notificationListQuerySchema,
  notificationSchema,
} from "@netram/validation";
import type { NotificationListQuery } from "@netram/types";
import { z } from "zod";

const markAllReadResponseSchema = z.object({ updated: z.number() });

export async function registerNotificationRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const notificationService = container.notificationService;
  const paramsSchema = toJsonSchema("NotificationIdParams", idParamsSchema);

  app.get(
    "/notifications",
    {
      schema: {
        tags: ["notifications"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("NotificationListQuery", notificationListQuerySchema),
        response: {
          200: toJsonSchema("NotificationListResponse", notificationListResponseSchema),
        },
      },
    },
    async (request) => {
      const q = request.query as unknown as NotificationListQuery;
      return notificationService.listNotifications(request.netram!, q);
    },
  );

  app.post(
    "/notifications/:id/read",
    {
      schema: {
        tags: ["notifications"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("Notification", notificationSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return notificationService.markRead(request.netram!, id);
    },
  );

  app.post(
    "/notifications/read-all",
    {
      schema: {
        tags: ["notifications"],
        security: [{ bearerAuth: [] }],
        response: {
          200: toJsonSchema("NotificationsMarkedRead", markAllReadResponseSchema),
        },
      },
    },
    async (request) => {
      return notificationService.markAllRead(request.netram!);
    },
  );
}
