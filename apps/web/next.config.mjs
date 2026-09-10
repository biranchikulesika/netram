/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
