import { loadServerEnv } from "@netram/config";

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return loadServerEnv(env);
}

export type AppConfig = ReturnType<typeof loadConfig>;
