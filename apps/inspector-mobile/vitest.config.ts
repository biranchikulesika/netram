import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "react-native": "react-native-web",
    },
  },
});
