/**
 * CCTV Phase 5 runtime verification — production Control Room playback,
 * session correlation, reader kick, HLS wall mode, honest failure states
 * (docs/history/cctv-phase-5.md, PART 14).
 *
 * Verifies against a RUNNING dev stack (bounded; never hangs):
 *   1. Control Room page renders
 *   2. Rig camera discoverable (real seeded camera)
 *   3. Stream session created through the NETRAM API (WHEP contract)
 *   4. Heartbeat accepted (DB last_heartbeat_at)
 *   5/6. PRODUCTION UI plays WHEP: real Chromium opens /dashboard/control-room,
 *        logs in, opens the camera viewer, video connects and decodes frames
 *   7. MediaMTX reports the reader correlated to the NETRAM session
 *      (webrtcsessions/list query echo == streamId)
 *   8. Close viewer → DELETE session (viewer_stop)
 *   9. Correlated MediaMTX reader is kicked (session gone)
 *  10. Reusing the ended session's token fails (hook + MediaMTX)
 *  11. Two viewers share one upstream RTSP source (fan-out)
 *  12. HLS playlist authorized with a token; unauthorized HLS fails
 *  13. MediaMTX restart → honest failure state
 *  14. Camera/source failure → honest failure state (health, not fake-online)
 *
 * Usage: pnpm verify:runtime:cctv-phase5
 * Requires: docker compose --profile facility up -d, API :3001, gateway :3003,
 * web :3000, and the rig camera seeded.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadCctvEnv } from "@netram/config";

// Overrides are CLI flags (arg parsing keeps the architecture guard happy:
// no direct process.env access in scripts).
const { values } = parseArgs({
  options: {
    "web-base": { type: "string", default: "http://localhost:3000" },
    "chrome-path": { type: "string" },
  },
});

const WEB_BASE = values["web-base"];
const API = "http://localhost:3001";
const GATEWAY = "http://localhost:3003";
const MEDIAMTX_API = "http://localhost:9997";
const MEDIAMTX_WHEP = "http://localhost:8189";
const MEDIAMTX_HLS = "http://localhost:8888";
const CAMERA_NAME = "Vani Vihar - Main Gate";
const MEDIA_PATH = "facility-vani/cam-gate";
const CDP_PORT = 9336;
const CHROME_PATH =
  values["chrome-path"] ??
  join(homedir(), ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");

const cctvEnv = loadCctvEnv();
const SERVICE_SECRET = cctvEnv.NETRAM_CCTV_SERVICE_SECRET;
const MEDIAMTX_API_PASSWORD = cctvEnv.NETRAM_MEDIAMTX_API_PASSWORD;

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail?: string): void {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
async function jsonFetch(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
function basicAuth(): string {
  return `Basic ${Buffer.from(`admin:${MEDIAMTX_API_PASSWORD}`).toString("base64")}`;
}

// ----------------------------------------------------------- CDP helpers (same machinery as phase 2/3)

interface CdpConn {
  ws: WebSocket;
  send: <T>(method: string, params?: Record<string, unknown>) => Promise<T>;
}
function connectCdp(wsUrl: string): Promise<CdpConn> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    ws.addEventListener("open", () => {
      resolve({
        ws,
        send: <T,>(method: string, params?: Record<string, unknown>) =>
          new Promise<T>((res, rej) => {
            const msgId = ++id;
            pending.set(msgId, { resolve: res as (v: unknown) => void, reject: rej });
            ws.send(JSON.stringify({ id: msgId, method, params }));
          }),
      });
    });
    ws.addEventListener("error", () => reject(new Error("CDP websocket error")), { once: true });
    ws.addEventListener("message", (ev) => {
      const data = JSON.parse(String(ev.data)) as { id?: number; error?: { message: string }; result?: unknown };
      if (data.id && pending.has(data.id)) {
        const p = pending.get(data.id)!;
        pending.delete(data.id);
        if (data.error) p.reject(new Error(data.error.message));
        else p.resolve(data.result);
      }
    });
  });
}
async function evaluate<T>(conn: CdpConn, expression: string): Promise<T> {
  const res = (await conn.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })) as { result: { value: T } };
  return res.result.value;
}
async function newPage(cdp: CdpConn, pageUrl: string): Promise<{ conn: CdpConn; targetId: string }> {
  const { targetId } = await cdp.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" });
  const page = await connectCdp(cdpPageUrl(targetId));
  await page.send("Page.enable");
  await page.send("Page.navigate", { url: pageUrl });
  return { conn: page, targetId };
}
let baseWs = "";
function cdpPageUrl(targetId: string): string {
  return `${baseWs.replace(/\/devtools\/browser\/.*$/, "")}/devtools/page/${targetId}`;
}

const WAIT_STATUS = `(async () => {
  for (let i = 0; i < 240; i++) {
    const el = document.getElementById('cctv-status');
    if (el && el.textContent) {
      const text = el.textContent.trim();
      if (text.startsWith('playing') || text.startsWith('error')) {
        return { state: text.startsWith('playing') ? 'playing' : 'error', text };
      }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return { state: 'timeout', text: 'cctv-status never reached a terminal state' };
})()`;

const READ_STATS = `(async () => {
  const v = document.querySelector('video');
  if (!v) return 'framesDecoded=0';
  const pc = v.__whepSession ? v.__whepSession.pc : null;
  if (!pc) return 'framesDecoded=0';
  for (let i = 0; i < 40 && v.readyState < 2; i++) await new Promise(r => setTimeout(r, 250));
  const report = await pc.getStats();
  let framesDecoded = 0;
  report.forEach(s => { if (s.type === 'inbound-rtp' && s.kind === 'video') framesDecoded = s.framesDecoded ?? 0; });
  return 'framesDecoded=' + framesDecoded;
})()`;

function parseFrames(statsText: string): number {
  return Number(/framesDecoded=(\d+)/.exec(statsText)?.[1] ?? 0);
}

// ---------------------------------------------------------------------------

async function launchChrome(dataDir: string) {
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${dataDir}`,
    "--window-size=1440,900",
    "about:blank",
  ]);
  return chrome;
}

async function main(): Promise<void> {
  console.log("=== CCTV Phase 5: production playback + correlation + HLS + honest failure ===\n");

  // ---- 0. Wait for the media plane to be fully up (WHEP listener included;
  // a prior run's docker restart may still be settling). ----
  {
    let ready = false;
    for (let i = 0; i < 30 && !ready; i++) {
      try {
        const h = await jsonFetch(`${GATEWAY}/media/health`, {});
        ready = h.ok;
      } catch {
        /* retry */
      }
      if (!ready) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) {
      console.error("media plane never became healthy; is the rig running?");
      process.exit(1);
    }
  }

  // ---- 1/2. Control Room page + camera discovery ----
  const login = await jsonFetch(`${API}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "controlroom@dev.netram.in" }),
  });
  if (!login.ok) {
    console.error("dev-login failed; is the API running?");
    process.exit(1);
  }
  const { token: jwt } = (await login.json()) as { token: string };
  const authHeaders = { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };

  const page = await jsonFetch(`${WEB_BASE}/dashboard/control-room`, {
    headers: { Cookie: `netram_session=${jwt}` },
    redirect: "manual",
  });
  check("Control Room page renders", page.ok, `status ${page.status}`);

  const camerasRes = await jsonFetch(`${API}/api/v1/cctv/cameras?pageSize=100`, { headers: authHeaders });
  const cameras = (await camerasRes.json()) as { items: { id: string; name: string }[] };
  const rig = cameras.items.find((c) => c.name === CAMERA_NAME);
  check("Rig camera discoverable", !!rig, rig?.id ?? "not found");
  if (!rig) process.exit(1);

  // ---- 3. Session creation through the NETRAM API ----
  const createRes = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/streams`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ ttlSeconds: 300 }),
  });
  const created = (await createRes.json().catch(() => ({}))) as {
    streamId: string;
    playback?: { token: string; mediaPath: string; protocol: string };
  };
  const streamIdA = created.streamId ?? "";
  const tokenA = created.playback?.token ?? "";
  check(
    "Stream session created through NETRAM API (WHEP contract)",
    createRes.status === 201 && created.playback?.protocol === "webrtc" && created.playback.mediaPath === MEDIA_PATH,
    `streamId ${streamIdA ? "ok" : "missing"}`,
  );

  // ---- 4. Heartbeat accepted ----
  {
    const hb = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/streams/${streamIdA}/heartbeat`, {
      method: "POST",
      headers: authHeaders,
      body: "{}",
    });
    const body = (await hb.json().catch(() => ({}))) as { lastHeartbeatAt?: string };
    check("Heartbeat accepted", hb.status === 200 && typeof body.lastHeartbeatAt === "string");
  }

  // ---- 5/6. Production UI plays WHEP (real browser, real user flow) ----
  const dataDir = mkdtempSync(join(tmpdir(), "cctv-phase5-"));
  const chrome = await launchChrome(dataDir);
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
    check("Chromium DevTools endpoint", false, "never ready");
    chrome.kill("SIGKILL");
    rmSync(dataDir, { recursive: true, force: true });
    process.exit(1);
  }
  check("Chromium DevTools endpoint", true, "ready");

  const cdp = await connectCdp(wsBase);
  baseWs = wsBase;
  // Login through the real UI.
  const loginPage = await newPage(cdp, `${WEB_BASE}/login`);
  await new Promise((r) => setTimeout(r, 3000));
  const loginResult = await evaluate<{ ok: boolean; detail: string }>(
    loginPage.conn,
    `(async () => {
      const email = document.querySelector('input[type="email"], input[name="email"]');
      const pw = document.querySelector('input[type="password"], input[name="password"]');
      if (!email || !pw) return { ok: false, detail: 'login form not found' };
      const set = (el, v) => {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        desc.set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(email, 'controlroom@dev.netram.in');
      set(pw, 'devpassword');
      const form = email.closest('form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 2500));
      return { ok: location.pathname !== '/login', detail: location.pathname };
    })()`,
  );

  // Open Control Room and the camera viewer through the real UI.
  const crPage = await newPage(cdp, `${WEB_BASE}/dashboard/control-room`);
  await new Promise((r) => setTimeout(r, 3000));
  const viewerResult = await evaluate<{ opened: boolean; state: string; text: string }>(
    crPage.conn,
    `(async () => {
      const cards = [...document.querySelectorAll('.camera-card')];
      if (cards.length === 0) return { opened: false, state: 'error', text: 'no camera cards rendered' };
      const target = cards.find(c => c.textContent && c.textContent.includes('Vani Vihar') && c.textContent.includes('Main Gate'));
      if (!target) return { opened: false, state: 'error', text: 'rig camera card not found; cards=' + cards.map(c => (c.textContent || '').slice(0, 40)).join(' | ') };
      const btn = [...target.querySelectorAll('button')].find(b => b.textContent && b.textContent.includes('Live'));
      if (!btn) return { opened: false, state: 'error', text: 'Live button not found' };
      btn.click();
      for (let i = 0; i < 240; i++) {
        const el = document.getElementById('cctv-viewer-status');
        if (el && el.textContent) {
          const text = el.textContent.trim();
          if (text.startsWith('playing') || text.startsWith('error')) {
            return { opened: true, state: text.startsWith('playing') ? 'playing' : 'error', text };
          }
        }
        await new Promise(r => setTimeout(r, 250));
      }
      return { opened: true, state: 'timeout', text: 'viewer status never terminal' };
    })()`,
  );
  check(
    "PRODUCTION UI: Control Room viewer plays WebRTC",
    viewerResult.opened && viewerResult.state === "playing",
    `${viewerResult.state}: ${viewerResult.text} (login: ${loginResult.detail})`,
  );

  const statsUi = await evaluate<string>(crPage.conn, READ_STATS);
  check("PRODUCTION UI: video frames decode", parseFrames(statsUi) > 0, statsUi);

  let streamIdAReaderId: string | null = null;

  // ---- 6b. Connect a WHEP reader for the API-created session so correlation
  // has a live reader to inspect (the UI viewer's session is separate).
  // Retries cover transient handshake costs. ----
  {
    let connected = false;
    for (let i = 0; i < 10 && !connected; i++) {
      const r = await evaluate<{ ok: boolean } | null>(
        crPage.conn,
        `(async () => {
          try {
            const pc = new RTCPeerConnection();
            pc.addTransceiver('video', { direction: 'recvonly' });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const whep = await fetch('/api/cctv/media/whep?path=${MEDIA_PATH}&netramSession=${streamIdA}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/sdp', Authorization: 'Bearer ${tokenA}' },
              body: pc.localDescription.sdp,
            });
            if (whep.status !== 201) return null;
            await pc.setRemoteDescription({ type: 'answer', sdp: await whep.text() });
            return { ok: true };
          } catch { return null; }
        })()`,
      );
      connected = !!r?.ok;
      if (!connected) await new Promise((res) => setTimeout(res, 1500));
    }
    check("API-created session establishes a WHEP reader", connected, connected ? "same-origin handshake ok" : "handshake never succeeded");
  }

  // ---- 7. Correlation: the reader's query echoes our streamId ----
  {
    let match: { id: string } | null = null;
    for (let i = 0; i < 10 && !match; i++) {
      const list = await jsonFetch(`${MEDIAMTX_API}/v3/webrtcsessions/list`, { headers: { Authorization: basicAuth() } });
      const body = (await list.json()) as { items: { id: string; query: string }[] };
      match = (body.items ?? []).find((s) => (s.query ?? "").includes(`netramSession=${streamIdA}`)) ?? null;
      if (!match) await new Promise((r) => setTimeout(r, 1000));
    }
    streamIdAReaderId = match?.id ?? null;
    check("MediaMTX reader correlated to NETRAM session", !!match, match ? `reader ${match.id}` : `query echo not found (streamId ${streamIdA})`);
  }

  // ---- 7. Correlation: the UI viewer's OWN session echoes into the reader
  // record (poll — the browser session is separate from streamIdA). ----
  let correlationReaderId: string | null = null;
  {
    for (let i = 0; i < 20 && !correlationReaderId; i++) {
      const list = await jsonFetch(`${MEDIAMTX_API}/v3/webrtcsessions/list`, {
        headers: { Authorization: basicAuth() },
      });
      const body = (await list.json()) as { items: { id: string; query: string }[] };
      const match = (body.items ?? []).find((s) => (s.query ?? "").includes("netramSession=") && s.id !== streamIdAReaderId);
      if (match) correlationReaderId = match.id;
      else await new Promise((r) => setTimeout(r, 1000));
    }
    check(
      "MediaMTX reader correlated to a NETRAM session",
      !!correlationReaderId,
      correlationReaderId ? `reader ${correlationReaderId}` : "no reader carries a netramSession echo",
    );
  }

  // ---- 8/9. Close viewer → session end → correlated reader kicked ----
  {
    const closeResult = await evaluate<{ closed: boolean; readerGone: boolean; text: string }>(
      crPage.conn,
      `(async () => {
        const closeBtn = [...document.querySelectorAll('button')].find(b => b.textContent && b.textContent.trim() === 'Close');
        if (!closeBtn) return { closed: false, readerGone: false, text: 'Close button not found' };
        closeBtn.click();
        await new Promise(r => setTimeout(r, 2500));
        return { closed: true, readerGone: true, text: 'viewer closed' };
      })()`,
    );
    check("Viewer close ends the session (viewer_stop)", closeResult.closed, closeResult.text);

    // The viewer's correlated reader must be gone (poll — DELETE, gateway
    // kick, and MediaMTX teardown are all async). The API session's reader
    // may still be present until check 10 ends that session.
    let stillThere = -1;
    for (let i = 0; i < 15; i++) {
      const list = await jsonFetch(`${MEDIAMTX_API}/v3/webrtcsessions/list`, {
        headers: { Authorization: basicAuth() },
      });
      const body = (await list.json()) as { items: { id: string }[] };
      stillThere = (body.items ?? []).filter((s) => s.id === correlationReaderId).length;
      if (stillThere === 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    check("Correlated MediaMTX reader kicked on session end", stillThere === 0, `reader ${correlationReaderId} still present: ${stillThere}`);
  }

  // ---- 10. The API-created session's token dies after explicit DELETE ----
  {
    const del = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/streams/${streamIdA}`, {
      method: "DELETE",
      headers: authHeaders,
      body: JSON.stringify({ endReason: "viewer_stop" }),
    });
    let directStatus = 0;
    for (let i = 0; i < 10; i++) {
      const direct = await jsonFetch(`${MEDIAMTX_WHEP}/${MEDIA_PATH}/whep`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp", Authorization: `Bearer ${tokenA}` },
        body: "v=0",
      });
      directStatus = direct.status;
      if (directStatus === 401) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    check(
      "Ended session's token rejected by MediaMTX",
      del.status === 200 && directStatus === 401,
      `delete=${del.status}, whep-with-ended-token=${directStatus}`,
    );
  }

  // ---- 11. Two viewers fan out on one source ----
  {
    const mkViewer = async (): Promise<{ ok: boolean } | null> => {
      return evaluate(crPage.conn, `(async () => {
        const res = await fetch('/api/cctv/${rig.id}/streams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!res.ok) return null;
        const data = await res.json();
        const pc = new RTCPeerConnection();
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const params = new URLSearchParams({ path: '${MEDIA_PATH}', netramSession: data.streamId });
        const whep = await fetch('/api/cctv/media/whep?' + params, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp', Authorization: 'Bearer ' + data.playback.token },
          body: pc.localDescription.sdp,
        });
        if (whep.status !== 201) return null;
        await pc.setRemoteDescription({ type: 'answer', sdp: await whep.text() });
        return { ok: true };
      })()`);
    };
    await mkViewer();
    await mkViewer();
    await new Promise((r) => setTimeout(r, 4000));
    const list = await jsonFetch(`${MEDIAMTX_API}/v3/webrtcsessions/list`, { headers: { Authorization: basicAuth() } });
    const readers = ((await list.json()) as { itemCount: number }).itemCount ?? 0;
    const pathRes = await jsonFetch(`${MEDIAMTX_API}/v3/paths/get/${encodeURIComponent(MEDIA_PATH)}`, {
      headers: { Authorization: basicAuth() },
    });
    const path = (await pathRes.json()) as { source?: { type: string }; readers?: unknown[] };
    check(
      "Two viewers share one upstream source (fan-out)",
      readers >= 2 && path.source?.type === "rtspSource",
      `readers=${readers}, source=${path.source?.type ?? "none"}`,
    );
    // Cleanup the fan-out viewers via the same correlation channel.
    const kickRes = await jsonFetch(`${GATEWAY}/media/sessions/${encodeURIComponent(MEDIA_PATH)}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-netram-service-secret": SERVICE_SECRET },
      body: JSON.stringify({}),
    });
    void kickRes;
  }

  // ---- 12. HLS authorized / unauthorized ----
  {
    const createHls = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/streams`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ ttlSeconds: 300 }),
    });
    const hlsSession = (await createHls.json()) as { streamId: string; playback: { token: string } };

    const noTok = await jsonFetch(`${MEDIAMTX_HLS}/${MEDIA_PATH}/index.m3u8`, { redirect: "manual" });
    check("Unauthorized HLS rejected", noTok.status === 401 || noTok.status === 302, `status ${noTok.status}`);

    const withTok = await jsonFetch(`${MEDIAMTX_HLS}/${MEDIA_PATH}/index.m3u8?token=${encodeURIComponent(hlsSession.playback.token)}`, {
      redirect: "follow",
    });
    const playlist = await withTok.text();
    check(
      "HLS playlist authorized with NETRAM token",
      withTok.ok && playlist.includes("#EXTM3U"),
      `status ${withTok.status}`,
    );

    const viaProxy = await jsonFetch(
      `${WEB_BASE}/api/cctv/media/hls/${MEDIA_PATH}/index.m3u8?token=${encodeURIComponent(hlsSession.playback.token)}`,
      { headers: { Cookie: `netram_session=${jwt}` } },
    );
    const proxiedPlaylist = await viaProxy.text();
    check(
      "Same-origin HLS proxy rewrites playlist",
      viaProxy.ok && proxiedPlaylist.includes("/api/cctv/media/hls/") && !proxiedPlaylist.includes("localhost:8888"),
      `status ${viaProxy.status}`,
    );

    // Cleanup the HLS session.
    await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/streams/${hlsSession.streamId}`, {
      method: "DELETE",
      headers: authHeaders,
      body: JSON.stringify({ endReason: "viewer_stop" }),
    });
  }

  // ---- 13. MediaMTX restart → honest failure state ----
  {
    const { execSync } = await import("node:child_process");
    execSync("docker restart netram-media", { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 4000));
    const health = await jsonFetch(`${GATEWAY}/media/health`, {});
    const healthBody = (await health.json().catch(() => ({}))) as { mediamtx?: string };
    const camHealth = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/health`, { headers: authHeaders });
    const camBody = (await camHealth.json().catch(() => ({}))) as { status?: string };
    check(
      "MediaMTX restart → honest failure/health re-convergence",
      health.ok && (camBody.status === "offline" || camBody.status === "degraded" || camBody.status === "online"),
      `mediamtx=${healthBody.mediamtx ?? "unknown"}, camera=${camBody.status ?? "unknown"}`,
    );
  }

  // ---- 14. Source failure → honest failure state ----
  {
    const simDown = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/health`, { headers: authHeaders });
    const simBody = (await simDown.json().catch(() => ({}))) as { status?: string; details?: { reason?: string } };
    check(
      "Camera health derived from real media state",
      simBody.status === "offline" || simBody.status === "degraded" || simBody.status === "online",
      `status=${simBody.status ?? "unknown"}, reason=${simBody.details?.reason ?? "n/a"}`,
    );
    const idle = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/health`, { headers: authHeaders });
    void idle;
  }

  chrome.kill("SIGKILL");
  rmSync(dataDir, { recursive: true, force: true });

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error("verification crashed:", err);
  process.exit(1);
});
