import { z } from "zod";

export const nodeEnvSchema = z.enum(["development", "test", "ci", "demo", "production"]);

export const stringToBool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1")
  .pipe(z.boolean());

export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment configuration:\n${issues}`);
  }
  return result.data;
}
