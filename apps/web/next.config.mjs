import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: a stray package-lock.json outside this repo makes
  // Next infer the wrong root, which breaks production page-data collection
  // ("Cannot find module for page: /_document") on `next build`.
  outputFileTracingRoot: path.join(appDir, "../../"),
  // Workspace packages ship TypeScript source imported with NodeNext ".js"
  // specifiers. Map them back to the real ".ts" source files.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },

};

export default nextConfig;
