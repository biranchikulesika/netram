import { z } from "zod";
import { nodeEnvSchema } from "./schema.js";

/**
 * CCTV / media-plane configuration (§7, §15, §42).
 *
 * Two deliberately distinct MediaMTX addresses:
 *  - NETRAM_MEDIAMTX_API_URL          — internal control API (gateway → MediaMTX,
 *                                       server-side only, never browser-facing)
 *  - NETRAM_MEDIAMTX_WHEP_PUBLIC_URL  — browser-facing WHEP base minted into
 *                                       playback contracts
 * They are NOT necessarily the same host/port and must never be conflated.
 */
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
  /** Shared secret the NETRAM API presents to the gateway (service-to-service, §14). */
  NETRAM_CCTV_SERVICE_SECRET: z
    .string()
    .min(32)
    .default("replace-me-with-a-32-char-plus-cctv-service-secret"),
  /** Internal MediaMTX control API base URL (gateway → MediaMTX). */
  NETRAM_MEDIAMTX_API_URL: z.url().default("http://localhost:9997"),
  /** MediaMTX control API credentials (Basic auth), server-side only. */
  NETRAM_MEDIAMTX_API_USERNAME: z.string().min(1).default("admin"),
  NETRAM_MEDIAMTX_API_PASSWORD: z.string().min(1).default("netram-dev-internal"),
  /** Browser-facing WHEP base the gateway mints into playback contracts. */
  NETRAM_MEDIAMTX_WHEP_PUBLIC_URL: z.url().default("http://localhost:8189"),
  /**
   * Dev-only ingest override: when set, the gateway provisions MediaMTX paths
   * from this source instead of DB camera endpoints. Exists because the dev
   * rig's real RTSP source lives at a compose-network address the DB seed
   * endpoints intentionally do not carry. Empty/unset in production-oriented
   * deployments, where DB endpoints are authoritative.
   */
  NETRAM_MEDIAMTX_DEV_INGEST_SOURCE: z.string().default(""),
  /**
   * Secret the MediaMTX external auth hook must present on every call
   * (Phase 4 §13). The hook runs in the NETRAM API; this is checked by the
   * API, not the gateway. Set to "" only for throwaway local debugging.
   */
  NETRAM_MEDIAMTX_HOOK_SECRET: z
    .string()
    .min(32)
    .default("replace-me-with-a-32-char-plus-mediamtx-hook-secret"),
  /**
   * Verification mode for runtime verification scripts: when true, no media
   * rig (MediaMTX) is attached, so camera health must be expected to reflect
   * that reality (never "online") and media-plane handshakes are skipped.
   * CI sets this; rig-based local verification leaves it unset.
   */
  NETRAM_CCTV_VERIFY_NO_RIG: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type CctvEnv = z.infer<typeof cctvEnvSchema>;
