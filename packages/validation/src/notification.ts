import { z } from "zod";
import { NOTIFICATION_STATUSES, NOTIFICATION_TYPES } from "@netram/types";
import { paginationSchema } from "./common.js";

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().max(200),
  body: z.string().max(4000).nullable(),
  status: z.enum(NOTIFICATION_STATUSES),
  createdAt: z.string().datetime(),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  total: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const notificationListQuerySchema = paginationSchema;
