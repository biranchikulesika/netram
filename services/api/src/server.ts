import { loadConfig } from "./config.js";
import { buildContainer } from "./infrastructure/container.js";
import { buildApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const container = buildContainer(config);
  const app = await buildApp(container);

  const port = config.NETRAM_API_PORT;
  const host = config.NETRAM_API_HOST;

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
