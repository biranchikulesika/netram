#!/usr/bin/env node
/**
 * Security scan (AGENTS.md §22, §65).
 * Blocks commits / CI that would leak secrets into the repository.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const problems = [];

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  ".turbo",
  ".expo",
  "coverage",
  ".pnpm",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name) || entry.name.endsWith(".egg-info")) {
      continue;
    }
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (entry.isFile()) {
      out.push(p);
    }
  }
  return out;
}

const FILES = walk(ROOT).filter(
  (f) =>
    !/(\.env\.example$|package-lock\.json$|pnpm-lock\.yaml$|^\.gitignore$|^scripts\/)/.test(
      f.slice(ROOT.length + 1),
    ),
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
      problems.push(`${f.slice(ROOT.length + 1)}: possible ${what}`);
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
