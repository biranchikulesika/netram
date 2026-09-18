#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { resolve } from "node:path";

interface SuiteResult {
  name: string;
  script: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

const SUITES = [
  { name: "CCTV Gateway Runtime", script: "scripts/verify-cctv-runtime.ts" },
  { name: "Evidence & Cryptographic Integrity", script: "scripts/verify-evidence-runtime.ts" },
  { name: "Mobile Offline Sync & Idempotency", script: "scripts/verify-mobile-offline-runtime.ts" },
  { name: "Web Workspaces & Access Control", script: "scripts/verify-web-runtime.ts" },
  { name: "Worker Pool & Outbox Dispatcher", script: "scripts/verify-workers-runtime.ts" },
];

function runScript(scriptPath: string): Promise<{ passed: boolean; durationMs: number; error?: string }> {
  return new Promise((resolvePromise) => {
    const start = Date.now();
    const fullPath = resolve(process.cwd(), scriptPath);
    const child = spawn("npx", ["tsx", fullPath], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      if (code === 0) {
        resolvePromise({ passed: true, durationMs });
      } else {
        resolvePromise({
          passed: false,
          durationMs,
          error: `Process exited with code ${code}`,
        });
      }
    });

    child.on("error", (err) => {
      const durationMs = Date.now() - start;
      resolvePromise({
        passed: false,
        durationMs,
        error: err.message,
      });
    });
  });
}

async function checkApiReadiness(apiUrl = "http://localhost:3001"): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("==================================================================");
  console.log("🛡️  Netram Unified Master Runtime Smoke Verification Suite");
  console.log("    Department of Social Justice & Empowerment (DoSJE)");
  console.log("==================================================================\n");

  const isApiReady = await checkApiReadiness();
  if (!isApiReady) {
    console.warn("⚠️  [NOTICE] Local API service (http://localhost:3001) is not responding.");
    console.warn("   For live end-to-end runtime smoke checks across all services, ensure:");
    console.warn("   1. Docker containers are active: `pnpm infra:up`");
    console.warn("   2. Dev services are running:   `pnpm dev` (in a separate terminal)\n");
    console.warn("   Proceeding to attempt runtime suites...\n");
  }

  const results: SuiteResult[] = [];
  let allPassed = true;

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    console.log(`\n------------------------------------------------------------------`);
    console.log(`[${i + 1}/${SUITES.length}] Starting Suite: ${suite.name} (${suite.script})`);
    console.log(`------------------------------------------------------------------\n`);

    const result = await runScript(suite.script);
    results.push({
      name: suite.name,
      script: suite.script,
      passed: result.passed,
      durationMs: result.durationMs,
      error: result.error,
    });

    if (!result.passed) {
      allPassed = false;
      console.error(`\n❌ [FAIL] ${suite.name} encountered an error: ${result.error || "failed"}`);
    } else {
      console.log(`\n✅ [PASS] ${suite.name} completed successfully (${(result.durationMs / 1000).toFixed(2)}s)`);
    }
  }

  console.log("\n==================================================================");
  console.log("📊 RUNTIME VERIFICATION SUMMARY REPORT");
  console.log("==================================================================");

  for (const r of results) {
    const icon = r.passed ? "✅ PASS" : "❌ FAIL";
    const timing = `(${(r.durationMs / 1000).toFixed(2)}s)`.padStart(8);
    console.log(`  ${icon}  ${timing}  ${r.name}`);
  }

  const totalPassed = results.filter((r) => r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log("------------------------------------------------------------------");
  console.log(`Total: ${totalPassed}/${results.length} suites passed in ${(totalDuration / 1000).toFixed(2)}s`);
  console.log("==================================================================");

  if (!allPassed) {
    console.error("\n❌ Master smoke verification failed. Review logs above.");
    process.exit(1);
  } else {
    console.log("\n✅ All 5 runtime verification suites passed cleanly!");
    process.exit(0);
  }
}

void main();
