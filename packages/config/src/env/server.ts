import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";

export const authProviderSchema = z.enum(["dev", "supabase"]);

export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  DATABASE_URL: z.url().describe("PostgreSQL connection URL"),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NETRAM_API_HOST: z.string().default("0.0.0.0"),
  NETRAM_API_PORT: z.coerce.number().int().positive().default(3001),
  NETRAM_AUTH_PROVIDER: authProviderSchema.default("dev"),
  NETRAM_DEV_AUTH_SECRET: z
    .string()
    .min(32)
    .describe("HMAC secret for local development JWT signing. NEVER set in production."),
  NETRAM_API_URL: z.url().default("http://localhost:3001"),
  NETRAM_REALTIME_URL: z.url().default("http://localhost:3002"),
  NETRAM_REALTIME_PORT: z.coerce.number().int().positive().default(3002),
  NETRAM_SUPABASE_URL: z
    .url()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v ? v : undefined)),
  NETRAM_SUPABASE_JWT_SECRET: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  /**
   * Allowed browser origins for CORS. Comma-separated list, e.g.
   * "http://localhost:3000,http://localhost:8081" (web app + Expo web).
   * A single value and the wildcard "*" remain valid.
   */
  NETRAM_CORS_ORIGIN: z
    .string()
    .default("*")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  NETRAM_OBJECT_STORAGE_ENDPOINT: z.string().default("http://localhost:9000"),
  NETRAM_OBJECT_STORAGE_ACCESS_KEY: z.string().default("netram"),
  NETRAM_OBJECT_STORAGE_SECRET_KEY: z.string().default("netram-secret"),
  NETRAM_OBJECT_STORAGE_BUCKET: z.string().default("netram"),
  NETRAM_OBJECT_STORAGE_USE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NETRAM_CCTV_GATEWAY_URL: z.url().default("http://localhost:3003"),
  NETRAM_CCTV_STREAM_SECRET: z
    .string()
    .min(32)
    .default("replace-me-with-a-32-char-plus-cctv-stream-secret"),
  /** Shared secret the NETRAM API presents to the CCTV gateway (§14). */
  NETRAM_CCTV_SERVICE_SECRET: z
    .string()
    .min(32)
    .default("replace-me-with-a-32-char-plus-cctv-service-secret"),
  /** Secret the MediaMTX external auth hook must present (Phase 4, §13). */
  NETRAM_MEDIAMTX_HOOK_SECRET: z
    .string()
    .min(32)
    .default("replace-me-with-a-32-char-plus-mediamtx-hook-secret"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
