import { loadCctvEnv } from "@netram/config";

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = loadCctvEnv(env);
  return {
    host: parsed.NETRAM_CCTV_GATEWAY_HOST,
    port: parsed.NETRAM_CCTV_GATEWAY_PORT,
    gatewayUrl: parsed.NETRAM_CCTV_GATEWAY_URL,
    streamSecret: parsed.NETRAM_CCTV_STREAM_SECRET,
    logLevel: parsed.LOG_LEVEL,
    nodeEnv: parsed.NODE_ENV,
  };
}

export type CctvGatewayConfig = ReturnType<typeof loadConfig>;
