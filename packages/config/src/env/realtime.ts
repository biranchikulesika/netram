import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";

export const realtimeEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  DATABASE_URL: z.url().describe("PostgreSQL connection URL"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NETRAM_API_URL: z.url().default("http://localhost:3001"),
  NETRAM_REALTIME_PORT: z.coerce.number().int().positive().default(3002),
  NETRAM_REALTIME_POLL_MS: z.coerce.number().int().positive().default(1000),
  NETRAM_REALTIME_OUTBOX_BATCH: z.coerce.number().int().positive().default(50),
});

export type RealtimeEnv = z.infer<typeof realtimeEnvSchema>;
