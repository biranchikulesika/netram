import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";

export const cctvEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NETRAM_CCTV_GATEWAY_HOST: z.string().default("0.0.0.0"),
  NETRAM_CCTV_GATEWAY_PORT: z.coerce.number().int().positive().default(3003),
  NETRAM_CCTV_GATEWAY_URL: z.url().default("http://localhost:3003"),
  NETRAM_CCTV_STREAM_SECRET: z
    .string()
    .min(32)
    .default("replace-me-with-a-32-char-plus-cctv-stream-secret"),
});

export type CctvEnv = z.infer<typeof cctvEnvSchema>;
