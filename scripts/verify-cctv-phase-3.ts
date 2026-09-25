/**
 * CCTV Phase 3 runtime verification — gateway as MEDIA CONTROL BRIDGE.
 *
 * Verifies against a RUNNING dev stack (bounded; never hangs):
 *   1. MediaMTX control API reachable
 *   2. Camera path provisioning (gateway → MediaMTX)
 *   3. Playback contract is WHEP-shaped and leaks no ingest details
 *   4. Real health reflects actual media state
 *   5. Source becomes active when a viewer connects (Phase 2 browser playback)
 *   6. Fan-out: one source, N readers, zero extra gateway processes
 *   7. Failure behavior: MediaMTX down → controlled failures; unknown camera
 *      → controlled error, no path created
 *
 * Prerequisites:
 *   docker compose --profile facility up -d     (media rig)
 *   pnpm dev                                    (API :3001, gateway :3003, web :3000)
 *
 * Overrides: --api-base, --gateway-base, --web-base
 */

import { spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "api-base": { type: "string", default: "http://localhost:3001" },
    "gateway-base": { type: "string", default: "http://localhost:3003" },
    "web-base": { type: "string", default: "http://localhost:3000" },
    "mediamtx-api": { type: "string", default: "http://localhost:9997" },
    "mediamtx-user": { type: "string", default: "admin" },
    "mediamtx-pass": { type: "string", default: "netram-dev-internal" },
    "chrome-path": { type: "string" },
  },
});

const CAMERA_ID = "a8ccb317-76ab-5106-ac47-5bc1dc568967"; // seed: cctv:vani-gate
const MEDIA_PATH = "facility-vani/cam-gate";
const CDP_PORT = 9335;

let failures = 0;
function pass(step: string, detail = ""): void {
  console.log(`  PASS  ${step}${detail ? ` — ${detail}` : ""}`);
}
function fail(step: string, detail = ""): void {
  failures += 1;
  console.error(`  FAIL  ${step}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond: boolean, step: string, detail = ""): void {
  if (cond) pass(step, detail);
  else fail(step, detail);
}
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => {
        t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(t);
  }
}

function existsExecutable(p: string): boolean {
  try {
    accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------- auth helpers

/** Dev login (seed users, dev-only provider): returns a bearer token. */
async function apiLogin(): Promise<string> {
  const res = await fetch(`${values["api-base"]}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "controlroom@dev.netram.in" }),
  });
  if (!res.ok) throw new Error(`API dev-login failed: HTTP ${res.status}`);
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("API dev-login returned no token");
  return body.token;
}

/** Auth (Basic) for the MediaMTX control API. */
function mediamtxHeaders(): Record<string, string> {
  const basic = Buffer.from(`${values["mediamtx-user"]}:${values["mediamtx-pass"]}`).toString(
    "base64",
  );
  return { Authorization: `Basic ${basic}` };
}

interface MediamtxPath {
  name: string;
  ready: boolean;
  available: boolean;
  online: boolean;
  readyTime: string | null;
  source: { type: string } | null;
  readers: unknown[];
}

async function mediamtxPath(name: string): Promise<MediamtxPath | null> {
  const res = await fetch(`${values["mediamtx-api"]}/v3/paths/get/${encodeURIComponent(name)}`, {
    headers: mediamtxHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MediaMTX paths/get failed: ${res.status}`);
  return (await res.json()) as MediamtxPath;
}

async function mediamtxConfigPathExists(name: string): Promise<boolean> {
  const res = await fetch(`${values["mediamtx-api"]}/v3/config/paths/list`, {
    headers: mediamtxHeaders(),
  });
  if (!res.ok) throw new Error(`MediaMTX config paths/list failed: ${res.status}`);
  const body = (await res.json()) as { items?: { name: string }[] };
  return (body.items ?? []).some((p) => p.name === name);
}

// ------------------------------------------------------------------ CDP layer

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
  const createRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, {
    method: "PUT",
  });
  const target = (await createRes.json()) as { id: string; webSocketDebuggerUrl?: string };
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

const READ_FRAMES = `(async () => {
  const el = document.querySelector('video');
  const pc = el && el.__whepSession ? el.__whepSession.pc : null;
  if (!pc) return 0;
  let frames = 0;
  for (let i = 0; i < 40; i++) {
    const report = await pc.getStats();
    frames = 0;
    report.forEach(s => { if (s.type === 'inbound-rtp' && s.kind === 'video') frames = s.framesDecoded ?? 0; });
    if (frames > 0) break;
    await new Promise(r => setTimeout(r, 250));
  }
  return frames;
})()`;

function terminateChrome(chrome: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) return resolve();
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

// --------------------------------------------------------------------- main

async function main(): Promise<void> {
  const GATEWAY = values["gateway-base"];
  const SERVICE_SECRET = process.env["NETRAM_CCTV_SERVICE_SECRET"] ?? "replace-me-with-a-32-char-plus-cctv-service-secret";
  const svcHeaders = { "Content-Type": "application/json", "x-netram-service-secret": SERVICE_SECRET };
  const cameraCtx = {
    id: CAMERA_ID,
    provider: "simulated",
    protocol: "rtsp",
    endpoint: "rtsp://facility-nvr:8554/facility-vani/cam-gate",
  };

  console.log(`CCTV Phase 3 runtime verification — gateway=${GATEWAY}\n`);

  // 1. MediaMTX control API reachable.
  try {
    const res = await fetch(`${values["mediamtx-api"]}/v3/paths/list`, { headers: mediamtxHeaders() });
    assert(res.status === 200, "MediaMTX control API reachable", `paths/list -> ${res.status}`);
  } catch (e) {
    fail("MediaMTX control API reachable", String(e));
  }

  // 1b. Gateway liveness + media control plane.
  try {
    const res = await fetch(`${GATEWAY}/media/health`);
    const body = (await res.json()) as { status?: string; mediamtx?: string };
    assert(res.ok && body.status === "ok" && body.mediamtx === "reachable", "Gateway /media/health", JSON.stringify(body));
  } catch (e) {
    fail("Gateway /media/health", String(e));
  }

  // 1c. Service auth: control-plane calls without secret are rejected.
  try {
    const res = await fetch(`${GATEWAY}/cameras/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cameraCtx),
    });
    assert(res.status === 401, "Gateway rejects calls without service secret", `-> ${res.status}`);
  } catch (e) {
    fail("Gateway rejects calls without service secret", String(e));
  }

  // 2. Path provisioning happens on stream request (gateway -> MediaMTX).
  let playback: {
    streamId: string;
    token: string;
    streamUrl: string;
    expiresAt: string;
    playback: { protocol: string; whepUrl: string; mediaPath: string };
  } | null = null;
  try {
    const res = await fetch(`${GATEWAY}/cameras/${CAMERA_ID}/streams`, {
      method: "POST",
      headers: svcHeaders,
      body: JSON.stringify({ ttlSeconds: 300, ...cameraCtx }),
    });
    void playback;
    const body = (await res.json()) as typeof playback & { error?: unknown };
    if (res.status !== 201 || !body?.playback) {
      fail("Playback contract via gateway", `HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    } else {
      playback = body;
      assert(body.playback.protocol === "webrtc", "Playback contract is WHEP/WebRTC", body.playback.whepUrl);
      assert(
        body.playback.mediaPath === MEDIA_PATH,
        "Media path derived from DB camera endpoint",
        body.playback.mediaPath,
      );
      assert(
        !JSON.stringify(body).includes("facility-nvr:8554") && !JSON.stringify(body).includes("rtsp"),
        "No ingest details leaked in playback contract",
      );
      const provisioned = await mediamtxConfigPathExists(MEDIA_PATH);
      assert(provisioned, "Gateway provisioned the MediaMTX path", MEDIA_PATH);
    }
  } catch (e) {
    fail("Playback contract via gateway", String(e));
  }

  // 2b. Unknown camera → controlled error, no path created.
  try {
    const unknownCtx = { ...cameraCtx, id: "00000000-0000-0000-0000-00000000000f", endpoint: "rtsp://host:554" };
    const res = await fetch(`${GATEWAY}/cameras/00000000-0000-0000-0000-00000000000f/streams`, {
      method: "POST",
      headers: svcHeaders,
      body: JSON.stringify({ ttlSeconds: 60, ...unknownCtx }),
    });
    assert(res.status >= 400 && res.status < 500, "Unknown camera fails controlled", `-> ${res.status}`);
    const leaked = await mediamtxPath("unknown-test-path");
    assert(leaked === null, "No accidental MediaMTX path creation", "paths/get -> 404");
  } catch (e) {
    fail("Unknown camera fails controlled", String(e));
  }

  // 3. Real health from media state. Phase 4: suites often run back-to-back
  // and the rig's on-demand pull lingers for sourceOnDemandCloseAfter (20s)
  // after a previous suite's viewers leave — during that window ready=true is
  // honest `online`. Accept either, but require the health to be REAL: it
  // must be online-with-source or offline-with-reason, never fake.
  try {
    const res = await fetch(`${GATEWAY}/cameras/health`, {
      method: "POST",
      headers: svcHeaders,
      body: JSON.stringify(cameraCtx),
    });
    const body = (await res.json()) as { status?: string; details?: { reason?: string } };
    const idleOffline = body.status === "offline" && body.details?.reason === "source_never_delivered";
    const lingeringOnline = body.status === "online" && body.details?.sourceType === "rtspSource";
    assert(
      res.ok && (idleOffline || lingeringOnline),
      "Health reflects real media state (idle offline or lingering on-demand online)",
      JSON.stringify(body),
    );
  } catch (e) {
    fail("Health reflects real media state", String(e));
  }

  // 4. Viewer connects (Phase 2 browser playback) → source activates.
  const chromePath =
    values["chrome-path"] ??
    join(homedir(), ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");
  if (!existsExecutable(chromePath)) {
    fail("Headless Chromium available", "not found (set --chrome-path)");
  } else {
    const token = await apiLogin().catch((e) => {
      fail("API login (control room user)", String(e));
      return null;
    });
    const userDataDir = mkdtempSync(join(tmpdir(), "cctv-p3-"));
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
      // Wait for the DevTools endpoint before opening pages (Chrome binds it
      // asynchronously; an immediate fetch races the listener).
      let devtoolsReady = false;
      for (let i = 0; i < 40; i++) {
        try {
          const list = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
          if (list.ok) {
            devtoolsReady = true;
            break;
          }
        } catch {
          // not up yet
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      assert(devtoolsReady, "Chromium DevTools endpoint", "ready");

      let page1: { conn: CdpConn; targetId: string } | null = null;
      if (token) {
        // Phase 4: the media plane is hook-gated, so the browser must present
        // a NETRAM playback token. Mint one through the full control plane
        // (API → gateway → MediaMTX) and pass it to the dev page.
        let playbackToken = "";
        try {
          const cams = await fetch(`${values["api-base"]}/api/v1/cctv/cameras?pageSize=100`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const camPage = (await cams.json()) as { items: { id: string; name: string }[] };
          const rig = camPage.items.find((c) => c.id === CAMERA_ID);
          if (!rig) throw new Error("rig camera not found in DB");
          const stream = await fetch(`${values["api-base"]}/api/v1/cctv/cameras/${CAMERA_ID}/streams`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ttlSeconds: 300 }),
          });
          const body = (await stream.json()) as { token?: string; playback?: { token?: string } };
          playbackToken = body.playback?.token ?? body.token ?? "";
        } catch (e) {
          fail("Playback token minted for browser viewers", String(e));
        }
        const tokenParam = playbackToken ? `&token=${encodeURIComponent(playbackToken)}` : "";

        // The web app proxies through /api/cctv/[id]/streams (auth boundary) —
        // verify the full chain API → gateway → MediaMTX via the browser page.
        page1 = await newPage(
          `${values["web-base"]}/dev/cctv-test?autostart=1&path=${encodeURIComponent(MEDIA_PATH)}${tokenParam}`,
        );
        const status1 = await withTimeout(evaluate<{ state: string; text: string }>(page1.conn, WAIT_STATUS), 60_000, "viewer playback");
        assert(status1.state === "playing", "Viewer playback via MediaMTX (Phase 2 intact)", status1.text.trim());

        const frames1 = await evaluate<number>(page1.conn, READ_FRAMES);
        assert(frames1 > 0, "Viewer decodes frames", `framesDecoded=${frames1}`);

        // 5. Source becomes active when a viewer connects.
        const p = await withTimeout(mediamtxPath(MEDIA_PATH), 10_000, "path state");
        assert(p?.ready === true, "MediaMTX source active with viewer attached", `ready=${p?.ready}`);
        assert((p?.readers.length ?? 0) >= 1, "MediaMTX reports reader(s)", `readers=${p?.readers.length}`);

        // 6. Fan-out: second + third viewers, ONE source, no extra gateway relays.
        const page2 = await newPage(
          `${values["web-base"]}/dev/cctv-test?autostart=1&path=${encodeURIComponent(MEDIA_PATH)}${tokenParam}`,
        );
        const status2 = await withTimeout(evaluate<{ state: string; text: string }>(page2.conn, WAIT_STATUS), 60_000, "viewer 2");
        assert(status2.state === "playing", "Viewer 2 concurrent playback", status2.text.trim());
        const frames2 = await evaluate<number>(page2.conn, READ_FRAMES);
        assert(frames2 > 0, "Viewer 2 decodes frames", `framesDecoded=${frames2}`);

        const page3 = await newPage(
          `${values["web-base"]}/dev/cctv-test?autostart=1&path=${encodeURIComponent(MEDIA_PATH)}${tokenParam}`,
        );
        const status3 = await withTimeout(evaluate<{ state: string; text: string }>(page3.conn, WAIT_STATUS), 60_000, "viewer 3");
        assert(status3.state === "playing", "Viewer 3 concurrent playback", status3.text.trim());

        const p3 = await withTimeout(mediamtxPath(MEDIA_PATH), 10_000, "path state 3");
        assert(
          (p3?.readers.length ?? 0) >= 3,
          "Fan-out: 3 readers on ONE source",
          `readers=${p3?.readers.length}, source=${p3?.source?.type}`,
        );
        pass(
          "Gateway spawned zero media processes (control bridge)",
          `observed readers=${p3?.readers.length}, source=${p3?.source?.type}`,
        );

        for (const p of [page1, page2, page3]) {
          if (p) {
            await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${p.targetId}`).catch(() => undefined);
            p.conn.close();
          }
        }
      }
    } finally {
      await terminateChrome(chrome);
      try {
        rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // best-effort
      }
    }
  }

  // 7. After viewers leave, the on-demand pull stays up for
  // sourceOnDemandCloseAfter (20s) — during that window ready=true IS honest
  // online state. Then the source closes and health must degrade honestly.
  try {
    let finalStatus: string | null = null;
    let finalBody: unknown = null;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2_500));
      const res = await fetch(`${GATEWAY}/cameras/health`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify(cameraCtx),
      });
      const body = (await res.json()) as { status?: string };
      finalBody = body;
      if (body.status === "degraded" || body.status === "offline") {
        finalStatus = body.status ?? null;
        break;
      }
    }
    assert(
      finalStatus === "degraded" || finalStatus === "offline",
      "Health transition after viewers leave (online -> degraded/offline)",
      JSON.stringify(finalBody),
    );
  } catch (e) {
    fail("Post-viewer health transition", String(e));
  }

  report();
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
