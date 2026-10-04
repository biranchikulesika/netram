/**
 * CCTV Phase 1+2 runtime verification (development rig).
 *
 * Verifies the media pipeline end-to-end against a RUNNING dev stack:
 *   camera-sim (FFmpeg) -> facility-nvr -> [network boundary] ->
 *   netram-media (MediaMTX, on-demand pull) -> WHEP -> real headless Chromium
 *   -> /dev/cctv-test page -> live <video>.
 *
 * Uses Chrome DevTools Protocol over WebSocket (Node native fetch/WebSocket,
 * no extra dependencies) against a Playwright-cached Chromium binary.
 *
 * Prerequisites:
 *   docker compose --profile facility up -d
 *   pnpm dev:web            (or web already running on :3000)
 *   Playwright chromium in ~/.cache/ms-playwright (browser only, no npm pkg)
 *
 * Bounded: every step has a timeout; the script never hangs.
 */

import { spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

// Overrides are CLI flags (arg parsing keeps the architecture guard happy:
// no direct process.env access in scripts).
const { values } = parseArgs({
  options: {
    "web-base": { type: "string", default: "http://localhost:3000" },
    "whep-path": { type: "string", default: "facility-vani/cam-gate" },
    "chrome-path": { type: "string" },
  },
});

const WEB_BASE = values["web-base"];
const WHEP_PATH = values["whep-path"];
const CDP_PORT = 9333;
const CHROME_CANDIDATES = [
  values["chrome-path"],
  join(homedir(), ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome"),
];

let failures = 0;

function pass(step: string, detail: string): void {
  console.log(`  PASS  ${step}${detail ? ` - ${detail}` : ""}`);
}

function fail(step: string, detail: string): void {
  failures += 1;
  console.error(`  FAIL  ${step}${detail ? ` - ${detail}` : ""}`);
}

function assert(cond: boolean, step: string, detail: string): void {
  if (cond) pass(step, detail);
  else fail(step, detail);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------- CDP layer

interface CdpTarget {
  id: string;
  webSocketDebuggerUrl?: string;
}

interface CdpConn {
  call(method: string, params?: Record<string, unknown>): Promise<unknown>;
  close(): void;
}

async function connectCdp(wsUrl: string): Promise<CdpConn> {
  const ws = new WebSocket(wsUrl);
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP websocket error")), { once: true });
    }),
    10_000,
    "CDP connect",
  );

  let msgId = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  ws.addEventListener("message", (event) => {
    const data = JSON.parse(String(event.data));
    if (typeof data.id === "number" && pending.has(data.id)) {
      const p = pending.get(data.id)!;
      pending.delete(data.id);
      if (data.error !== undefined) p.reject(new Error(data.error.message ?? "CDP error"));
      else p.resolve(data.result);
    }
  });

  return {
    call(method, params = {}) {
      const id = ++msgId;
      return withTimeout(
        new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          ws.send(JSON.stringify({ id, method, params }));
        }),
        90_000,
        `CDP ${method}`,
      );
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate<T>(conn: CdpConn, expression: string): Promise<T> {
  const result = (await conn.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })) as { result?: { value?: T } };
  return result.result?.value as T;
}

async function newPage(pageUrl: string): Promise<{ conn: CdpConn; targetId: string }> {
  // Create about:blank, connect, then navigate via CDP and wait until the
  // app shell is present - evaluating too early can land in the stale
  // about:blank context and observe nothing forever.
  const createRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, {
    method: "PUT",
  });
  const target = (await createRes.json()) as CdpTarget;
  if (!target.webSocketDebuggerUrl) throw new Error("CDP target has no webSocketDebuggerUrl");
  const conn = await connectCdp(target.webSocketDebuggerUrl);
  await conn.call("Runtime.enable");
  await conn.call("Page.enable");
  await conn.call("Page.navigate", { url: pageUrl });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const present = await evaluate<boolean>(conn, "!!document.getElementById('cctv-status')");
    if (present === true) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  return { conn, targetId: target.id };
}

async function closePage(targetId: string): Promise<void> {
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${targetId}`).catch(() => undefined);
}

const WAIT_STATUS = `(async () => {
  for (let i = 0; i < 60; i++) {
    const el = document.getElementById('cctv-status');
    const t = el ? (el.textContent ?? '') : '';
    if (t.includes('playing')) return { state: 'playing', text: t };
    if (t.includes('error')) return { state: 'error', text: t };
    await new Promise(r => setTimeout(r, 500));
  }
  return { state: 'timeout', text: document.getElementById('cctv-status')?.textContent ?? '' };
})()`;

const READ_STATS = `(async () => {
  const el = document.querySelector('video');
  const pc = el && el.__whepSession ? el.__whepSession.pc : null;
  if (!pc) return 'no-session';
  // Poll until the first frames are decoded - 'connected' fires slightly
  // before the decoder produces output.
  let framesDecoded = 0, jitterDelaySec = 0, jitterEmitted = 0;
  for (let i = 0; i < 40; i++) {
    framesDecoded = 0; jitterDelaySec = 0; jitterEmitted = 0;
    const report = await pc.getStats();
    report.forEach(s => {
      if (s.type === 'inbound-rtp' && s.kind === 'video') {
        framesDecoded = s.framesDecoded ?? 0;
        jitterDelaySec += s.jitterBufferDelay ?? 0;
        jitterEmitted += s.jitterBufferEmittedCount ?? 0;
      }
    });
    if (framesDecoded > 0) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const latency = jitterEmitted > 0 ? Math.round(jitterDelaySec / jitterEmitted * 1000) : null;
  return 'framesDecoded=' + framesDecoded + ' jitterBufferLatencyMs=' + latency;
})()`;

function parseFrames(statsText: string): number {
  return Number(/framesDecoded=(\d+)/.exec(statsText)?.[1] ?? 0);
}

function parseLatency(statsText: string): string | null {
  return /jitterBufferLatencyMs=(\d+)/.exec(statsText)?.[1] ?? null;
}

// --------------------------------------------------------------- main checks

async function main(): Promise<void> {
  console.log(`CCTV Phase 1+2 runtime verification - web=${WEB_BASE} path=${WHEP_PATH}\n`);

  // 1. Media rig reachable AND closed: the WHEP endpoint answers, but
  // Phase 4 delegates playback auth to the NETRAM hook, so a request without
  // a NETRAM playback token must be rejected (401) - reachability + closure
  // in one probe.
  try {
    const res = await fetch(`http://localhost:8189/${WHEP_PATH}/whep`, { method: "OPTIONS" });
    assert(
      res.status === 401,
      "MediaMTX WHEP reachable but closed",
      `OPTIONS -> ${res.status} (hook-gated)`,
    );
  } catch (e) {
    fail("MediaMTX WHEP reachable but closed", String(e));
  }

  // 1b. Phase 4 regression: mint a real NETRAM playback token through the
  // full control plane and use it for browser playback (the media plane is
  // no longer dev-open, so the browser MUST present a Bearer token).
  let playbackToken: string | null = null;
  try {
    const apiBase = WEB_BASE.replace(":3000", ":3001");
    const login = await fetch(`${apiBase}/api/v1/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "controlroom@netram.dev" }),
    });
    const { token: jwt } = (await login.json()) as { token: string };
    const cams = await fetch(`${apiBase}/api/v1/cctv/cameras?pageSize=100`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const camPage = (await cams.json()) as { items: { id: string; name: string }[] };
    const rig = camPage.items.find((c) => c.name === "Vani Vihar - Main Gate");
    if (!rig) throw new Error("rig camera not found in DB");
    const stream = await fetch(`${apiBase}/api/v1/cctv/cameras/${rig.id}/streams`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttlSeconds: 300 }),
    });
    const body = (await stream.json()) as { token?: string; playback?: { token?: string } };
    playbackToken = body.playback?.token ?? body.token ?? null;
    assert(
      typeof playbackToken === "string" && playbackToken.length > 40,
      "NETRAM playback token minted",
      playbackToken ? "ok" : "missing",
    );
  } catch (e) {
    fail("NETRAM playback token minted", String(e));
  }
  const tokenParam = playbackToken ? `&token=${encodeURIComponent(playbackToken)}` : "";

  // 2. Web app serves the dev test page.
  try {
    const res = await fetch(`${WEB_BASE}/dev/cctv-test`);
    assert(res.status === 200, "Web /dev/cctv-test page", `GET -> ${res.status}`);
  } catch (e) {
    fail("Web /dev/cctv-test page", String(e));
  }

  // 3. Real browser: WHEP playback reaches 'playing' with decoded frames.
  const chromePath = CHROME_CANDIDATES.find((p) => p && existsExecutable(p));
  if (!chromePath) {
    fail("Headless Chromium", "not found (set VERIFY_CHROME_PATH)");
    report();
    return;
  }

  const userDataDir = mkdtempSync(join(tmpdir(), "cctv-verify-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    // Wait for the DevTools endpoint.
    let targets: CdpTarget[] = [];
    for (let i = 0; i < 40; i++) {
      try {
        const list = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        targets = (await list.json()) as CdpTarget[];
        if (targets.some((t) => t.webSocketDebuggerUrl)) break;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    assert(
      targets.some((t) => t.webSocketDebuggerUrl),
      "Chromium DevTools endpoint",
      "ready",
    );

    // Viewer 1: happy path (token-gated, Phase 4).
    const page1 = await newPage(
      `${WEB_BASE}/dev/cctv-test?autostart=1&path=${encodeURIComponent(WHEP_PATH)}${tokenParam}`,
    );
    const status1 = await withTimeout(
      evaluate<{ state: string; text: string }>(page1.conn, WAIT_STATUS),
      60_000,
      "viewer 1 playback",
    );
    assert(status1.state === "playing", "Viewer 1 WHEP playback", status1.text.trim());

    const stats1 = await evaluate<string>(page1.conn, READ_STATS);
    const frames1 = parseFrames(stats1);
    const latency1 = parseLatency(stats1);
    assert(frames1 > 0, "Viewer 1 decodes video frames", stats1.trim());
    pass(
      "Receiver jitter-buffer latency",
      latency1 !== null
        ? `${latency1}ms (glass-to-glass: run CAMERA_SOURCE=clock, see phase doc)`
        : "not yet reported",
    );

    // Liveness: frames keep increasing (not a frozen frame).
    await new Promise((r) => setTimeout(r, 4_000));
    const stats1b = await evaluate<string>(page1.conn, READ_STATS);
    const frames1b = parseFrames(stats1b);
    assert(frames1b > frames1, "Stream is live (frames advance)", `${frames1} -> ${frames1b}`);

    // 4. Fan-out: second concurrent viewer shares the same upstream pull.
    const page2 = await newPage(
      `${WEB_BASE}/dev/cctv-test?autostart=1&path=${encodeURIComponent(WHEP_PATH)}${tokenParam}`,
    );
    const status2 = await withTimeout(
      evaluate<{ state: string; text: string }>(page2.conn, WAIT_STATUS),
      60_000,
      "viewer 2 playback",
    );
    assert(
      status2.state === "playing",
      "Viewer 2 concurrent playback (fan-out)",
      status2.text.trim(),
    );
    const stats2 = await evaluate<string>(page2.conn, READ_STATS);
    assert(parseFrames(stats2) > 0, "Viewer 2 decodes video frames", stats2.trim());

    // 5. Failure path: unknown path must surface a surfaced error, not hang.
    const page3 = await newPage(
      `${WEB_BASE}/dev/cctv-test?autostart=1&path=${encodeURIComponent("facility-vani/does-not-exist")}`,
    );
    const status3 = await withTimeout(
      evaluate<{ state: string; text: string }>(page3.conn, WAIT_STATUS),
      60_000,
      "failure path",
    );
    assert(status3.state === "error", "Unknown path fails explicitly", status3.text.trim());

    for (const p of [page1, page2, page3]) {
      await closePage(p.targetId);
      p.conn.close();
    }
  } finally {
    await terminateChrome(chrome);
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // temp dir cleanup is best-effort; never mask the actual result
    }
  }

  report();
}

function existsExecutable(p: string): boolean {
  try {
    accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function terminateChrome(chrome: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      resolve();
      return;
    }
    const done = (): void => {
      chrome.removeListener("exit", done);
      resolve();
    };
    chrome.addListener("exit", done);
    chrome.kill("SIGTERM");
    setTimeout(() => {
      chrome.kill("SIGKILL");
      setTimeout(resolve, 200);
    }, 2_000);
  });
}

function report(): void {
  console.log("");
  if (failures > 0) {
    console.error(`RESULT: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("RESULT: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
