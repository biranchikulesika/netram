import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";
import { authProviderSchema } from "./server.js";

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  DATABASE_URL: z.url().describe("PostgreSQL connection URL"),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NETRAM_AUTH_PROVIDER: authProviderSchema.default("dev"),
  NETRAM_DEV_AUTH_SECRET: z.string().min(32).optional(),
  NETRAM_SMTP_URL: z.url().optional(),
  /** CCTV gateway control plane (Phase 4 stream-session sweeper, §14). */
  NETRAM_CCTV_GATEWAY_URL: z.url().default("http://localhost:3003"),
  /** Shared secret presented to the CCTV gateway (service-to-service, §14). */
  NETRAM_CCTV_SERVICE_SECRET: z
    .string()
    .min(32)
    .default("replace-me-with-a-32-char-plus-cctv-service-secret"),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
