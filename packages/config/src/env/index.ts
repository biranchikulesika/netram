import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "./schema.js";
import { serverEnvSchema, type ServerEnv } from "./server.js";
import { clientEnvSchema, type ClientEnv } from "./client.js";
import { workerEnvSchema, type WorkerEnv } from "./worker.js";
import { realtimeEnvSchema, type RealtimeEnv } from "./realtime.js";
import { cctvEnvSchema, type CctvEnv } from "./cctv.js";

function maybeLoadEnv(): void {
  try {
    if (typeof process.loadEnvFile === "function") {
      let cur = process.cwd();
      for (let i = 0; i < 5; i++) {
        const candidate = resolve(cur, ".env");
        if (existsSync(candidate)) {
          process.loadEnvFile(candidate);
          break;
        }
        const parent = resolve(cur, "..");
        if (parent === cur) break;
        cur = parent;
      }
    }
  } catch {
    // Ignore if already loaded or not found
  }
}

maybeLoadEnv();

export function loadServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return parseEnv(serverEnvSchema, env as Record<string, string | undefined>, "server");
}

export function loadClientEnv(env: NodeJS.ProcessEnv = process.env): ClientEnv {
  return parseEnv(clientEnvSchema, env as Record<string, string | undefined>, "client");
}

export function loadWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return parseEnv(workerEnvSchema, env as Record<string, string | undefined>, "worker");
}

export function loadRealtimeEnv(env: NodeJS.ProcessEnv = process.env): RealtimeEnv {
  return parseEnv(realtimeEnvSchema, env as Record<string, string | undefined>, "realtime");
}

export function loadCctvEnv(env: NodeJS.ProcessEnv = process.env): CctvEnv {
  return parseEnv(cctvEnvSchema, env as Record<string, string | undefined>, "cctv");
}

export type { ServerEnv, ClientEnv, WorkerEnv, RealtimeEnv, CctvEnv };
export * from "./server.js";
export * from "./client.js";
export * from "./cctv.js";
export { authProviderSchema } from "./server.js";
