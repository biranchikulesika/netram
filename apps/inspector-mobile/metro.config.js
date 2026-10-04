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

// 7. Proxy /api requests to target remote backend for browser web development
// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require("https");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");

/**
 * Public origin of the deployed Netram stack. This is the API base a device on
 * the Netram VPS can actually reach; loopback only exists on the build machine.
 */
const PRODUCTION_API_URL = "https://netram.kulesika.in";

/**
 * A release bundle pointed at loopback still builds cleanly and then fails on
 * the device as "no assignments", because the device cannot reach the build
 * machine's localhost. Fail the bundle instead of shipping an APK whose only
 * symptom looks like a data problem. `@expo/env` has already loaded any `.env`
 * files by the time this runs, so a local `.env` aimed at localhost is caught too.
 */
if (process.env.NODE_ENV === "production") {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl || /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(apiUrl)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be a device-reachable API base for release builds (got ${
        apiUrl ?? "undefined"
      }). Build with "pnpm build:release" or export EXPO_PUBLIC_API_URL=${PRODUCTION_API_URL}.`,
    );
  }
}

const targetApiUrl = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;
const parsedTarget = new URL(targetApiUrl);
const transport = parsedTarget.protocol === "https:" ? https : http;

const prevEnhance = defaultConfig.server?.enhanceMiddleware;
defaultConfig.server = {
  ...defaultConfig.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const wrapped = prevEnhance ? prevEnhance(metroMiddleware, server) : metroMiddleware;
    return (req, res, next) => {
      if (req.url && req.url.startsWith("/api/")) {
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "access-control-allow-headers": "*",
          });
          res.end();
          return;
        }

        const proxyReq = transport.request(
          {
            hostname: parsedTarget.hostname,
            port: parsedTarget.port || (parsedTarget.protocol === "https:" ? 443 : 80),
            path: req.url,
            method: req.method,
            headers: {
              ...req.headers,
              host: parsedTarget.hostname,
            },
          },
          (proxyRes) => {
            const headers = {
              ...proxyRes.headers,
              "access-control-allow-origin": "*",
            };
            res.writeHead(proxyRes.statusCode || 200, headers);
            proxyRes.pipe(res, { end: true });
          },
        );

        proxyReq.on("error", (err) => {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        });

        req.pipe(proxyReq, { end: true });
        return;
      }
      return wrapped(req, res, next);
    };
  },
};

module.exports = defaultConfig;
