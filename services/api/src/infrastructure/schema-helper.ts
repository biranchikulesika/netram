import { z } from "zod";

/**
 * Converts a shared Zod schema into a JSON Schema that Fastify consumes for
 * both request validation and OpenAPI generation. Zod remains the canonical
 * validation source; route schemas must not drift from it.
 *
 * Fastify's bundled Ajv validates draft-07, so we target it explicitly.
 */
export function toJsonSchema(_name: string, schema: z.ZodTypeAny): Record<string, unknown> {
  const converted = z.toJSONSchema(schema, { target: "draft-07" });
  return converted as unknown as Record<string, unknown>;
}
