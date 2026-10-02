import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";
import { authProviderSchema } from "./server.js";

export const clientEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  NEXT_PUBLIC_API_URL: z.url().describe("Public base URL of the Netram API for web/mobile clients"),
  /**
   * Server-side only. The base URL the web app's own server code (the /api/v1
   * BFF proxy and the CCTV/evidence route handlers) calls the Fastify API on.
   *
   * This is deliberately NOT NEXT_PUBLIC_API_URL. That value is the PUBLIC
   * origin, so a server-side hop to it must leave the host, resolve public DNS,
   * terminate TLS on the edge and traverse nginx back in. Besides being a
   * pointless round trip, it makes the app depend on its own public DNS and
   * certificate being correct before a single API call can work. The deployment
   * topology has the API on the internal service network, so that is what
   * server-side code must use.
   *
   * Never exposed to the browser, so it must not carry a public prefix.
   */
  NETRAM_API_BASE_URL: z
    .url()
    .default("http://localhost:3001")
    .describe("Internal (server-side) base URL of the Netram API."),
  /**
   * Auth-provider signal for the web login screen: when the deployment runs
   * the dev provider (local development or the demo VPS), the seeded demo
   * accounts are offered. Server-side signal; never shipped to the browser.
   */
  NETRAM_AUTH_PROVIDER: authProviderSchema.default("dev"),
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
