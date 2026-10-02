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
  playback: z
    .object({
      protocol: z.literal("webrtc"),
      whepUrl: z.string(),
      token: z.string(),
      mediaPath: z.string(),
    })
    .optional(),
});

/** MediaMTX external auth hook payload (verified against the live docs, v1.21.x). */
export const mediaAuthHookRequestSchema = z.object({
  user: z.string(),
  password: z.string(),
  token: z.string(),
  ip: z.string(),
  action: z.enum(["publish", "read", "playback", "api", "metrics", "pprof"]),
  path: z.string(),
  protocol: z.enum(["rtsp", "rtmp", "hls", "webrtc", "srt"]),
  id: z.string(),
  query: z.string(),
  userAgent: z.string(),
});

export type MediaAuthHookRequest = z.infer<typeof mediaAuthHookRequestSchema>;

/** Input for POST /cctv/cameras/:id/streams/:streamId/heartbeat. */
export const streamHeartbeatSchema = z
  .object({
    whepSessionId: z.string().min(1).max(100).optional(),
  })
  .strict();

/** Input for DELETE /cctv/cameras/:id/streams/:streamId. */
export const endStreamSchema = z
  .object({
    endReason: z.enum(["viewer_stop", "admin_revoke"]).default("viewer_stop"),
  })
  .strict();
