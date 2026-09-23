import { z } from "zod";

export const listCamerasQuerySchema = z
  .object({
    districtId: z.string().uuid().optional(),
    status: z.enum(["active", "inactive", "maintenance"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export type ListCamerasQuery = z.infer<typeof listCamerasQuerySchema>;

export const requestStreamSchema = z
  .object({
    ttlSeconds: z.coerce.number().int().min(30).max(3600).default(300),
  })
  .strict();

export type RequestStreamInput = z.infer<typeof requestStreamSchema>;

export const publicCctvCameraSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  provider: z.string(),
  protocol: z.string(),
  districtId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  status: z.enum(["active", "inactive", "maintenance"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const cctvCameraPageSchema = z.object({
  items: z.array(publicCctvCameraSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const cameraHealthStatusSchema = z.object({
  cameraId: z.string().uuid(),
  status: z.enum(["online", "offline", "degraded", "unknown"]),
  latencyMs: z.number().optional(),
  lastCheckedAt: z.string().datetime(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const authorizedStreamSchema = z.object({
  streamId: z.string(),
  cameraId: z.string().uuid(),
  streamUrl: z.string(),
  expiresAt: z.string().datetime(),
  token: z.string(),
});
