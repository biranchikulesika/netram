import { z } from "zod";
import { AUDIT_ACTIONS } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(AUDIT_ACTIONS),
  actorUserId: z.string().uuid().nullable(),
  resourceType: z.string().max(50).nullable(),
  resourceId: z.string().max(100).nullable(),
  requestId: z.string().max(100).nullable(),
  ipAddress: z.string().max(45).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  occurredAt: z.string().datetime(),
});

export const auditPageSchema = z.object({
  items: z.array(auditEventSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const auditListQuerySchema = paginationSchema.extend({
  action: z.enum(AUDIT_ACTIONS).optional(),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().max(100).optional(),
  actorUserId: uuidSchema.optional(),
});
