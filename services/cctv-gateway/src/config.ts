import { loadCctvEnv } from "@netram/config";

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = loadCctvEnv(env);
  return {
    host: parsed.NETRAM_CCTV_GATEWAY_HOST,
    port: parsed.NETRAM_CCTV_GATEWAY_PORT,
    gatewayUrl: parsed.NETRAM_CCTV_GATEWAY_URL,
    streamSecret: parsed.NETRAM_CCTV_STREAM_SECRET,
    /** Shared secret the NETRAM API must present (service-to-service, §14). */
    serviceSecret: parsed.NETRAM_CCTV_SERVICE_SECRET,
    /** Internal MediaMTX control API (server-side only). */
    mediamtxApiUrl: parsed.NETRAM_MEDIAMTX_API_URL,
    mediamtxApiUsername: parsed.NETRAM_MEDIAMTX_API_USERNAME,
    mediamtxApiPassword: parsed.NETRAM_MEDIAMTX_API_PASSWORD,
    /** Browser-facing WHEP base minted into playback contracts. */
    mediamtxWhepPublicUrl: parsed.NETRAM_MEDIAMTX_WHEP_PUBLIC_URL,
    /** Dev-only ingest override (dev rig convenience; empty in production). */
    devIngestSource: parsed.NETRAM_MEDIAMTX_DEV_INGEST_SOURCE,
    logLevel: parsed.LOG_LEVEL,
    nodeEnv: parsed.NODE_ENV,
  };
}

export type CctvGatewayConfig = ReturnType<typeof loadConfig>;
