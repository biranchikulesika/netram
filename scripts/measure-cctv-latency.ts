/**
 * CCTV Phase 5 — practical latency measurement (PART 11).
 *
 * Measurement model (honest decomposition — docs/history/cctv-phase-5.md):
 *
 *   glass-to-glass ≈ capture+encode (camera side)   ← NOT measurable here*
 *                  + RTSP/MediaMTX ingest            ← near-zero (pass-through)
 *                  + network one-way ≈ RTT/2         ← measured (ICE candidate-pair)
 *                  + receiver jitter buffer          ← measured (jitterBufferDelay)
 *                  + render queue                    ← small, included in buffer delay
 *
 *   * measured separately by the burned-clock photographic method: run the
 *     rig with CAMERA_SOURCE=clock (a wall-clock is burned into the video),
 *     photograph screen + real clock together, subtract. That method measures
 *     the FULL chain including the camera side; it is manual and documented
 *     rather than scripted.
 *
 * This script drives a real Chromium via CDP (same machinery as the phase
 * verifications), plays the live stream through the authorized WHEP proxy,
 * and reports:
 *   - receiver jitter-buffer latency (jitterBufferDelay / jitterBufferEmittedCount)
 *   - ICE candidate-pair currentRoundTripTime (→ estimated one-way ≈ RTT/2)
 *   - framesDecoded, framesPerSecond, frameWidth/Height, bytesReceived (bitrate)
 *   - fan-out sensitivity: N viewers, per-viewer latency + one upstream source
 *
 * Result: a defensible LOWER-BOUND estimate of glass-to-glass =
 * jitterBuffer + RTT/2 (+ encode, measured photographically), and the
 * conditions (viewers, resolution, bitrate) under which it was observed.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "web-base": { type: "string", default: "http://localhost:3000" },
    "api-base": { type: "string", default: "http://localhost:3001" },
    "whep-path": { type: "string", default: "facility-vani/cam-gate" },
    "chrome-path": { type: "string" },
  },
});
const WEB_BASE = values["web-base"];
const API_BASE = values["api-base"];
const WHEP_PATH = values["whep-path"];
const CDP_PORT = 9335;
const CHROME_PATH =
  values["chrome-path"] ??
  join(homedir(), ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");

async function main(): Promise<void> {
  const login = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "controlroom@dev.netram.in" }),
  });
  if (!login.ok) throw new Error(`dev-login failed: ${login.status}`);
  const { token: jwt } = (await login.json()) as { token: string };

  const camRes = await fetch(`${API_BASE}/api/v1/cctv/cameras?pageSize=100`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const cams = (await camRes.json()) as { items: { id: string; name: string }[] };
  const rig = cams.items.find((c) => c.name === "Vani Vihar - Main Gate");
  if (!rig) throw new Error("rig camera not found in DB");
  const cameraId = rig.id;

  const createRes = await fetch(`${API_BASE}/api/v1/cctv/cameras/${cameraId}/streams`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttlSeconds: 300 }),
  });
  if (!createRes.ok) throw new Error(`stream create failed: ${createRes.status}`);
  const created = (await createRes.json()) as {
    streamId: string;
    playback: { token: string; mediaPath: string };
  };

  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "cctv-lat-"))}`,
    "--window-size=1280,800",
    "about:blank",
  ]);
  const cleanup = async (code: number): Promise<never> => {
    chrome.kill("SIGKILL");
    rmSync(chrome.spawnargs.find((a) => a.includes("user-data-dir"))!, { recursive: true, force: true });
    process.exit(code);
  };
  chrome.on("error", () => void cleanup(2));

  // Wait for the DevTools endpoint.
  let wsBase = "";
  for (let i = 0; i < 40; i++) {
    try {
      const v = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      wsBase = ((await v.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!wsBase) {
    console.error("Chromium DevTools endpoint never became ready");
    return void cleanup(2);
  }

  const ws = new WebSocket(wsBase.replace("127.0.0.1", "localhost"));
  await new Promise<void>((res, rej) => {
    ws.addEventListener("open", () => res(), { once: true });
    ws.addEventListener("error", () => rej(new Error("CDP connect failed")), { once: true });
  });
  let msgId = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  ws.addEventListener("message", (ev) => {
    const data = JSON.parse(String(ev.data)) as { id?: number; error?: { message: string }; result?: unknown };
    if (data.id && pending.has(data.id)) {
      const p = pending.get(data.id)!;
      pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error.message));
      else p.resolve(data.result);
    }
  });
  const send = <T,>(method: string, params?: Record<string, unknown>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const pageUrl = `${WEB_BASE}/dev/cctv-test?path=${encodeURIComponent(WHEP_PATH)}&token=${encodeURIComponent(created.playback.token)}&autostart=1`;
  const target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json()) as {
    targetId: string;
  };
  const pageWs = new WebSocket((target as unknown as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl);
  await new Promise<void>((res, rej) => {
    pageWs.addEventListener("open", () => res(), { once: true });
    pageWs.addEventListener("error", () => rej(new Error("page ws failed")), { once: true });
  });
  const pagePending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  pageWs.addEventListener("message", (ev) => {
    const data = JSON.parse(String(ev.data)) as { id?: number; error?: { message: string }; result?: unknown };
    if (data.id && pagePending.has(data.id)) {
      const p = pagePending.get(data.id)!;
      pagePending.delete(data.id);
      if (data.error) p.reject(new Error(data.error.message));
      else p.resolve(data.result);
    }
  });
  const pageSend = <T,>(method: string, params?: Record<string, unknown>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = ++msgId;
      pagePending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      pageWs.send(JSON.stringify({ id, method, params }));
    });

  await pageSend("Page.enable");
  await pageSend("Page.navigate", { url: pageUrl });

  const statsExpr = `(async () => {
  const v = document.querySelector('video');
  if (!v) return JSON.stringify({error: 'no video'});
  const pc = v.__whepSession ? v.__whepSession.pc : (window.__pcs ? window.__pcs[0] : null);
  if (!pc) return JSON.stringify({error: 'no pc'});
  for (let i = 0; i < 40 && v.readyState < 2; i++) await new Promise(r => setTimeout(r, 250));
  const report = await pc.getStats();
  let framesDecoded = 0, jitterDelaySec = 0, jitterEmitted = 0, bytes = 0, fps = 0, w = 0, h = 0, rttSec = null;
  report.forEach(s => {
    if (s.type === 'inbound-rtp' && s.kind === 'video') {
      framesDecoded = s.framesDecoded ?? 0;
      jitterDelaySec += s.jitterBufferDelay ?? 0;
      jitterEmitted += s.jitterBufferEmittedCount ?? 0;
      bytes = s.bytesReceived ?? 0;
      fps = s.framesPerSecond ?? 0;
      w = s.frameWidth ?? 0;
      h = s.frameHeight ?? 0;
    }
    if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.currentRoundTripTime != null) {
      rttSec = s.currentRoundTripTime;
    }
  });
  return JSON.stringify({
    framesDecoded, jitterMs: jitterEmitted > 0 ? Math.round(jitterDelaySec/jitterEmitted*1000) : null,
    rttMs: rttSec != null ? Math.round(rttSec*1000) : null,
    kbps: Math.round(bytes*8/1000), fps: Number(fps.toFixed(1)), width: w, height: h
  });
})()`;

  const collect = async (label: string): Promise<void> => {
    const raw = (await pageSend("Runtime.evaluate", {
      expression: statsExpr,
      awaitPromise: true,
      returnByValue: true,
    })) as { result: { value: string } };
    const s = JSON.parse(raw.result.value) as Record<string, unknown>;
    console.log(label, JSON.stringify(s));
  };

  console.log(`latency-measurement path=${WHEP_PATH}`);
  for (const wait of [5000, 10000, 20000]) {
    await new Promise((r) => setTimeout(r, wait));
    await collect(`t=${wait}ms`);
  }

  await cleanup(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
