import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { loadConfig } from "../src/config.js";
import { buildContainer } from "../src/infrastructure/container.js";
import { buildApp } from "../src/app.js";

/**
 * Exports the canonical OpenAPI document from the running API's route
 * validation schemas. The typed API client is generated from this file.
 */
async function main() {
  const config = loadConfig();
  const container = buildContainer(config);
  const app = await buildApp(container);

  await app.ready();
  const spec = app.swagger();
  const out = resolve(import.meta.dirname, "../openapi/openapi.json");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(spec, null, 2));
  console.log(`OpenAPI exported to ${out}`);
  await app.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
