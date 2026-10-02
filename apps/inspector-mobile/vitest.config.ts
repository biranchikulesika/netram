import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    alias: {
      "react-native": "react-native-web",
    },
  },
});
