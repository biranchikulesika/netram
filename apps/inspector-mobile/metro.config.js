// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {ReturnType<typeof getDefaultConfig>} */
const defaultConfig = getDefaultConfig(projectRoot);

// 1. Watch local project and required workspace folders
defaultConfig.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, "packages"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 2. Resolve modules from both local and root node_modules
defaultConfig.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Map @netram/* packages and required web runtimes
const packages = ["api-client", "config", "data", "types", "ui", "validation"];
const extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react-refresh": path.resolve(projectRoot, "node_modules/react-refresh"),
  "@expo/metro-runtime": path.resolve(projectRoot, "node_modules/@expo/metro-runtime"),
  "react-native-helmet-async": path.resolve(projectRoot, "node_modules/react-native-helmet-async"),
  "@react-navigation/native": path.resolve(projectRoot, "node_modules/@react-navigation/native"),
};

packages.forEach((pkg) => {
  extraNodeModules[`@netram/${pkg}`] = path.resolve(workspaceRoot, `packages/${pkg}`);
});

defaultConfig.resolver.extraNodeModules = extraNodeModules;

// 4. Set source extensions
defaultConfig.resolver.sourceExts = ["ts", "tsx", "js", "jsx", "json", "cjs", "mjs"];

// 5. Custom resolver for ESM .js extension imports pointing to .ts/.tsx files and @netram/* subpaths
defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  // Prevent Expo tsconfigPaths from resolving "react" to "@types/react"
  // (which is used in tsconfig.json for TypeScript type pinning in this React 18 / 19 monorepo)
  if (
    moduleName === "react" ||
    moduleName.startsWith("react/") ||
    moduleName === "react-dom" ||
    moduleName.startsWith("react-dom/")
  ) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: "sourceFile",
    };
  }
  if (moduleName === "@netram/config/env/mobile" || moduleName === "@netram/config/env/mobile.js") {
    return {
      filePath: path.resolve(workspaceRoot, "packages/config/src/env/mobile.ts"),
      type: "sourceFile",
    };
  }
  if (moduleName.startsWith("@netram/config/")) {
    const subpath = moduleName.slice("@netram/config/".length).replace(/\.js$/, "");
    const tsFile = path.resolve(workspaceRoot, `packages/config/src/${subpath}.ts`);
    return {
      filePath: tsFile,
      type: "sourceFile",
    };
  }
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith(".js")) {
      const withoutJs = moduleName.slice(0, -3);
      try {
        return context.resolveRequest(context, withoutJs, platform);
      } catch {}
    }
    throw error;
  }
};

// 6. Disable hierarchical lookup is turned off to allow PNPM symlink traversing
defaultConfig.resolver.disableHierarchicalLookup = false;

module.exports = defaultConfig;
