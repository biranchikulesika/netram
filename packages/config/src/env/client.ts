import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";

export const clientEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  NEXT_PUBLIC_API_URL: z.url().describe("Public base URL of the Netram API for web/mobile clients"),
  NEXT_PUBLIC_REALTIME_WS_URL: z
    .string()
    .default("ws://localhost:3002")
    .describe("Public WebSocket URL of the realtime service for browsers"),
  NETRAM_MEDIAMTX_WHEP_URL: z
    .url()
    .default("http://localhost:8189")
    .describe(
      "MediaMTX WHEP HTTP endpoint used by the web server-side proxy route " +
        "(dev CCTV media rig). Server-side only within the web app; the " +
        "browser reaches WHEP same-origin through /api/dev/cctv/whep.",
    ),
  /** MediaMTX internal credentials injected server-side by the WHEP proxy. */
  NETRAM_MEDIAMTX_WHEP_USERNAME: z.string().min(1).default("admin"),
  NETRAM_MEDIAMTX_WHEP_PASSWORD: z.string().min(1).default("netram-dev-internal"),
  /** MediaMTX HLS HTTP endpoint (Phase 5 wall mode), same-origin via /api/cctv/media/hls. */
  NETRAM_MEDIAMTX_HLS_URL: z
    .url()
    .default("http://localhost:8888")
    .describe(
      "MediaMTX HLS endpoint used by the web server-side HLS proxy route. " +
        "Server-side only; the browser reaches HLS same-origin through " +
        "/api/cctv/media/hls (token-gated per request).",
    ),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
