// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Enforce single React 18 instance across monorepo packages
  if (
    moduleName === "react" ||
    moduleName.startsWith("react/") ||
    moduleName === "react-dom" ||
    moduleName.startsWith("react-dom/") ||
    moduleName === "react-native" ||
    moduleName.startsWith("react-native/") ||
    moduleName === "react-native-web" ||
    moduleName.startsWith("react-native-web/") ||
    moduleName === "react-native-safe-area-context" ||
    moduleName.startsWith("react-native-safe-area-context/") ||
    moduleName === "react-native-screens" ||
    moduleName.startsWith("react-native-screens/")
  ) {
    const forcedContext = {
      ...context,
      originModulePath: path.resolve(projectRoot, "package.json"),
    };
    if (originalResolveRequest) {
      return originalResolveRequest(forcedContext, moduleName, platform);
    }
    return context.resolveRequest(forcedContext, moduleName, platform);
  }

  try {
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    if (moduleName.endsWith(".js")) {
      const withoutJs = moduleName.slice(0, -3);
      if (originalResolveRequest) {
        return originalResolveRequest(context, withoutJs, platform);
      }
      return context.resolveRequest(context, withoutJs, platform);
    }
    throw err;
  }
};

module.exports = config;
