import { loadRealtimeEnv } from "@netram/config";

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = loadRealtimeEnv(env);
  return {
    port: parsed.NETRAM_REALTIME_PORT,
    apiUrl: parsed.NETRAM_API_URL,
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    pollIntervalMs: parsed.NETRAM_REALTIME_POLL_MS,
    maxOutboxBatch: parsed.NETRAM_REALTIME_OUTBOX_BATCH,
  };
}

export type RealtimeConfig = ReturnType<typeof loadConfig>;
