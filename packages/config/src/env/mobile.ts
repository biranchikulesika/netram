import { z } from "zod";

/**
 * Public mobile environment (AGENTS.md §21).
 *
 * Only EXPO_PUBLIC_* values are inlined into the React Native bundle. Referenced
 * as a literal `process.env.EXPO_PUBLIC_*` member access so Expo/Metro can
 * statically inline it; nothing here may import Node builtins (RN bundler).
 */
export const mobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z
    .url()
    .default("http://localhost:3001")
    .describe("Public base URL of the Netram API for the inspector mobile app"),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;

export function loadMobileEnv(): MobileEnv {
  const result = mobileEnvSchema.safeParse({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  });
  if (!result.success) {
    throw new Error("Invalid mobile environment configuration");
  }
  return result.data;
}
