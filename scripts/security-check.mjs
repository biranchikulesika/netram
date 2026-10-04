#!/usr/bin/env node
/**
 * Security scan.
 * Blocks commits / CI that would leak secrets into the repository.
 */
import { readdirSync, readFileSync } from "node:fs";
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
          ".next",
          "dist",
          "build",
          ".turbo",
          ".expo",
          "coverage",
          ".pnpm",
          ".temp",
          ".venv",
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

const rel = (f) => f.slice(ROOT.length + 1).replaceAll("\\", "/");

const FILES = walk(ROOT).filter(
  (f) =>
    !/(\.env\.example$|package-lock\.json$|pnpm-lock\.yaml$|^\.gitignore$|^scripts\/)/.test(rel(f)),
);

// High-signal secret patterns. These are deliberately suspicious, not exhaustive.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key material"],
  [/eyJhbGciOi[A-Za-z0-9+/=_-]{20,}/, "likely JWT token"],
  [/sk-[A-Za-z0-9]{20,}/, "API secret in source"],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, "slack token"],
  [/GH_PAT|github_pat_/, "GitHub personal access token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
];

for (const f of FILES) {
  const src = readFileSync(f, "utf8");
  for (const [re, what] of SECRET_PATTERNS) {
    if (re.test(src)) {
      problems.push(`${rel(f)}: possible ${what}`);
    }
  }
}

// The dev auth secret must never be the one used in production-facing config.
if (problems.length) {
  console.error("\nSecurity scan findings:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\n${problems.length} finding(s). Rotate anything already leaked and re-run.\n`);
  process.exit(1);
}

console.log("Security scan: OK");
