import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";

export const clientEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  NEXT_PUBLIC_API_URL: z.url().describe("Public base URL of the Netram API for web/mobile clients"),
  NEXT_PUBLIC_REALTIME_WS_URL: z
    .string()
    .default("ws://localhost:3002")
    .describe("Public WebSocket URL of the realtime service for browsers"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
