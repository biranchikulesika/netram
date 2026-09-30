#!/usr/bin/env node
/**
 * Mechanical architecture guards (AGENTS.md §66).
 * Fails the build when the architectural dependency boundaries are violated.
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const problems = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          ".git",
          "node_modules",
          "dist",
          ".next",
          ".turbo",
          ".expo",
          "openapi",
          "coverage",
          ".pnpm",
          ".kilo",
        ].includes(entry.name)
      )
        continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

const allFiles = walk(ROOT);
const tsFiles = allFiles.filter((f) => /\.(ts|tsx)$/.test(f));
const rel = (f) => f.slice(ROOT.length + 1).replaceAll("\\", "/");
const under = (f, seg) => rel(f).startsWith(seg + "/");

// Rule 1: database client/driver access only inside packages/data.
for (const f of tsFiles) {
  if (rel(f).startsWith("packages/data/")) continue;
  const src = readFileSync(f, "utf8");
  if (/(from ["'](drizzle-orm|postgres|pg)["'])/.test(src)) {
    problems.push(
      `${rel(f)}: DB imports (drizzle-orm/postgres/pg) are not allowed outside packages/data`,
    );
  }
}

// Rule 2: no cross-service source imports.
for (const f of tsFiles) {
  if (!rel(f).startsWith("services/")) continue;
  const src = readFileSync(f, "utf8");
  const m = src.match(/from ["']([^"']*services\/(api|ai|cctv-gateway|realtime)\/[^"']*src)/);
  if (m) {
    problems.push(
      `${rel(f)}: cross-service import of service internals ("${m[1]}") - only explicit contracts allowed`,
    );
  }
}

// Rule 3: one authoritative package manager + lockfile.
for (const lock of ["package-lock.json", "yarn.lock", "bun.lockb", "npm-shrinkwrap.json"]) {
  if (existsSync(join(ROOT, lock))) problems.push(`competing lockfile found: ${lock}`);
}

// Rule 4: env reads only through packages/config (that package itself is the exception,
// plus infra scripts/config bootstrap files and NODE_ENV sanity checks).
const ENV_EXEMPT = (f) =>
  rel(f).startsWith("packages/config/") ||
  rel(f).startsWith("packages/data/src/db/") ||
  /(drizzle\.config\.ts|migrate\.ts|seed\/index\.ts|src\/config\.ts|route\.ts$)/.test(rel(f));
for (const f of tsFiles) {
  if (ENV_EXEMPT(f)) continue;
  const src = readFileSync(f, "utf8");
  const envAccess = /process\.env\.([A-Z0-9_]+)/g;
  const hits = [...src.matchAll(envAccess)].map((m) => m[1]);
  if (hits.some((k) => k !== "NODE_ENV")) {
    problems.push(
      `${rel(f)}: direct process.env access (${[...new Set(hits)].join(", ")}) - configure via packages/config`,
    );
  }
}

// Rule 5: web app must not import database/data packages.
for (const f of tsFiles.filter((f) => rel(f).startsWith("apps/web/"))) {
  const src = readFileSync(f, "utf8");
  if (/(@netram\/data|drizzle-orm|["']postgres["']|["']pg["'])/.test(src)) {
    problems.push(`${rel(f)}: web app must not reach the data layer directly`);
  }
}

if (problems.length) {
  console.error("\nArchitecture guard violations:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\n${problems.length} violation(s). Fix the boundary, not the guard.\n`);
  process.exit(1);
}

const gi = existsSync(join(ROOT, ".gitignore"))
  ? readFileSync(join(ROOT, ".gitignore"), "utf8")
  : "";
const ignored = new Set(
  gi
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean),
);
for (const req of [".env", ".env.local", "node_modules/", ".next/", "dist/"]) {
  if (![...ignored].some((l) => l === req || l.startsWith(req))) {
    problems.push(`.gitignore missing required entry: ${req}`);
  }
}
if (problems.length) {
  console.error("\nArchitecture guard violations (.gitignore):");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\n${problems.length} violation(s).\n`);
  process.exit(1);
}

console.log("Architecture guards: OK");
