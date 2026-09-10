import { loadConfig } from "./config.js";
import { buildRealtimeServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = buildRealtimeServer(config);
  void server.start();

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
