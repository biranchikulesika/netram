import baseConfig from "./packages/config/eslint.config.mjs";

export default [
  {
    ignores: [".next", ".expo", "services/ai/**", "dist/**", ".turbo/**"],
  },
  ...baseConfig,
];
