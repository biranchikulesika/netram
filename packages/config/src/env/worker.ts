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
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
