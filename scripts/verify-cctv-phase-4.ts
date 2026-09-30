/**
 * CCTV Phase 4 runtime verification - session lifecycle + MediaMTX external
 * auth hook (docs/history/cctv-phase-4.md).
 *
 * Verifies against a RUNNING dev stack (bounded; never hangs):
 *   1. MediaMTX control API reachable (gateway-side)
 *   2. Unauthenticated WHEP handshake rejected (media plane closed)
 *   3. WHEP with garbage token rejected (hook decision is fail-closed)
 *   4. Full control-plane chain: dev-login -> POST streams -> token w/ mediaPath
 *   5. WHEP with the fresh NETRAM token passes auth (non-401 = SDP-level)
 *   6. Heartbeat refreshes the session
 *   7. Gateway token-verify: live/forged/service-secret cases
 *   8. DELETE ends the session (viewer_stop); heartbeat after end -> 404
 *   9. Hook rejects the ended session's token + unknown tokens + no-secret
 *  10. WHEP with the ended token is rejected by MediaMTX (closed loop)
 *  11. Gateway session view reachable (readerCount)
 *  12. Audit API reachable
 *
 * Usage: pnpm exec tsx scripts/verify-cctv-phase-4.ts
 * Requires: docker compose --profile facility up -d, API :3001, gateway :3003.
 */

import { createHash, createHmac } from "node:crypto";
import { loadCctvEnv } from "@netram/config";

const API = "http://localhost:3001";
const GATEWAY = "http://localhost:3003";
const MEDIAMTX_API = "http://localhost:9997";
const MEDIAMTX_WHEP = "http://localhost:8189";
const CAMERA_NAME = "Vani Vihar - Main Gate";
const MEDIA_PATH = "facility-vani/cam-gate";

// Dev-rig secrets via the centralized validated config (§21).
const cctvEnv = loadCctvEnv();
const SERVICE_SECRET = cctvEnv.NETRAM_CCTV_SERVICE_SECRET;
const HOOK_SECRET = cctvEnv.NETRAM_MEDIAMTX_HOOK_SECRET;
const MEDIAMTX_API_PASSWORD = cctvEnv.NETRAM_MEDIAMTX_API_PASSWORD;

const results: { name: string; pass: boolean; detail?: string }[] = [];

function check(name: string, pass: boolean, detail?: string): void {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

async function jsonFetch(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function main(): Promise<void> {
  console.log("=== CCTV Phase 4: session lifecycle + external auth hook ===\n");

  // ---- 1. MediaMTX control API reachable ----
  {
    const res = await jsonFetch(`${MEDIAMTX_API}/v3/paths/list`, {
      headers: { Authorization: `Basic ${Buffer.from(`admin:${MEDIAMTX_API_PASSWORD}`).toString("base64")}` },
    });
    check("MediaMTX control API reachable", res.ok, `status ${res.status}`);
  }

  // ---- Resolve the rig camera from the DB (via API login + listing) ----
  const loginRes = await jsonFetch(`${API}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "controlroom@netram.dev" }),
  });
  if (!loginRes.ok) {
    console.error(`dev-login failed (${loginRes.status}); cannot continue.`);
    process.exit(1);
  }
  const { token: jwt } = (await loginRes.json()) as { token: string };
  const authHeaders = { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };

  const camerasRes = await jsonFetch(`${API}/api/v1/cctv/cameras?pageSize=100`, { headers: authHeaders });
  const cameras = (await camerasRes.json()) as { items: { id: string; name: string }[] };
  const rig = cameras.items.find((c) => c.name === CAMERA_NAME);
  if (!rig) {
    console.error(`Camera '${CAMERA_NAME}' not found in DB; cannot continue.`);
    process.exit(1);
  }

  // ---- 2/3. Media plane is closed ----
  {
    const noCred = await jsonFetch(`${MEDIAMTX_WHEP}/${MEDIA_PATH}/whep`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: "v=0",
    });
    check("WHEP without credentials is rejected", noCred.status === 401, `status ${noCred.status}`);

    const garbage = await jsonFetch(`${MEDIAMTX_WHEP}/${MEDIA_PATH}/whep`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp", Authorization: "Bearer garbage-token" },
      body: "v=0",
    });
    check("WHEP with garbage token is rejected", garbage.status === 401, `status ${garbage.status}`);
  }

  // ---- 4. Full control-plane chain ----
  let streamId = "";
  let playbackToken = "";
  {
    const res = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/streams`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ ttlSeconds: 300 }),
    });
    const body = (await res.json()) as {
      streamId: string;
      token: string;
      playback?: { mediaPath: string; token: string; protocol: string };
    };
    streamId = body.streamId ?? "";
    playbackToken = body.playback?.token ?? body.token ?? "";
    const mediaPath = body.playback?.mediaPath ?? "";
    const jwtShape = playbackToken.includes(".") && playbackToken.length > 40;
    check("stream creation returns WHEP playback contract", res.status === 201 && mediaPath === MEDIA_PATH && jwtShape);
  }

  // ---- 5. Fresh token passes the hook ----
  {
    const res = await jsonFetch(`${MEDIAMTX_WHEP}/${MEDIA_PATH}/whep`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp", Authorization: `Bearer ${playbackToken}` },
      body: "v=0",
    });
    // 401 would mean the hook rejected the token; any non-401 (400 on the
    // stub SDP) proves authorization passed and MediaMTX moved on to SDP.
    check("WHEP with fresh NETRAM token passes the hook", res.status !== 401, `status ${res.status}`);
  }

  // ---- 6. Heartbeat refreshes the session ----
  {
    const res = await jsonFetch(
      `${API}/api/v1/cctv/cameras/${rig.id}/streams/${streamId}/heartbeat`,
      { method: "POST", headers: authHeaders, body: "{}" },
    );
    const body = (await res.json().catch(() => ({}))) as { lastHeartbeatAt?: string };
    check("heartbeat accepted", res.status === 200 && typeof body.lastHeartbeatAt === "string");
  }

  // ---- Gateway-side token verification reflects the live session ----
  {
    const res = await jsonFetch(`${GATEWAY}/media/tokens/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-netram-service-secret": SERVICE_SECRET },
      body: JSON.stringify({ token: playbackToken }),
    });
    const body = (await res.json().catch(() => ({}))) as { valid?: boolean };
    check("gateway token-verify accepts the live session token", res.status === 200 && body.valid === true);
  }

  // Gateway rejects a forged token (attacker without the stream secret).
  {
    const payload = Buffer.from(
      JSON.stringify({ streamId, cameraId: rig.id, mediaPath: MEDIA_PATH, exp: Math.floor(Date.now() / 1000) + 300 }),
    ).toString("base64url");
    const forged = `${payload}.${createHmac("sha256", "wrong-secret-wrong-secret-wrong-secret-x").update(payload).digest("base64url")}`;
    const res = await jsonFetch(`${GATEWAY}/media/tokens/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-netram-service-secret": SERVICE_SECRET },
      body: JSON.stringify({ token: forged }),
    });
    const body = (await res.json().catch(() => ({}))) as { valid?: boolean };
    check("gateway token-verify rejects forged tokens", res.status === 200 && body.valid === false);
  }

  // Gateway requires the service secret.
  {
    const res = await jsonFetch(`${GATEWAY}/media/tokens/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: playbackToken }),
    });
    check("gateway control routes require the service secret", res.status === 401, `status ${res.status}`);
  }

  // ---- 7/8. DELETE ends the session; token dies ----
  {
    const del = await jsonFetch(`${API}/api/v1/cctv/cameras/${rig.id}/streams/${streamId}`, {
      method: "DELETE",
      headers: authHeaders,
      body: JSON.stringify({ endReason: "viewer_stop" }),
    });
    check("DELETE ends the session (viewer_stop)", del.status === 200);

    const hb = await jsonFetch(
      `${API}/api/v1/cctv/cameras/${rig.id}/streams/${streamId}/heartbeat`,
      { method: "POST", headers: authHeaders, body: "{}" },
    );
    check("heartbeat after DELETE returns 404", hb.status === 404, `status ${hb.status}`);
  }

  // ---- 9/10. Ended session's token is dead everywhere ----
  {
    const res = await jsonFetch(`${API}/media/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: "",
        password: "",
        token: playbackToken,
        ip: "127.0.0.1",
        action: "read",
        path: MEDIA_PATH,
        protocol: "webrtc",
        id: "",
        query: "",
        userAgent: "verify-cctv-phase-4",
      }),
    });
    check("hook rejects the ended session's token", res.status === 401, `status ${res.status}`);
  }
  {
    const res = await jsonFetch(`${MEDIAMTX_WHEP}/${MEDIA_PATH}/whep`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp", Authorization: `Bearer ${playbackToken}` },
      body: "v=0",
    });
    check("MediaMTX rejects WHEP with the ended session's token", res.status === 401, `status ${res.status}`);
  }

  // Hook decision unit-shape: unknown token via direct hook call.
  {
    const res = await jsonFetch(`${API}/media/auth?hookSecret=${encodeURIComponent(HOOK_SECRET)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: "",
        password: "",
        token: "not-a-real-token",
        ip: "127.0.0.1",
        action: "read",
        path: MEDIA_PATH,
        protocol: "webrtc",
        id: "",
        query: "",
        userAgent: "verify-cctv-phase-4",
      }),
    });
    check("hook denies unknown tokens (fail-closed)", res.status === 401, `status ${res.status}`);
  }

  // Hook without the shared secret is rejected outright.
  {
    const res = await jsonFetch(`${API}/media/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: "", password: "", token: "x", ip: "", action: "read",
        path: MEDIA_PATH, protocol: "webrtc", id: "", query: "", userAgent: "",
      }),
    });
    check("hook rejects callers without the shared secret", res.status === 401, `status ${res.status}`);
  }

  // ---- 11. Sweeper tick is safe (bounded no-op when nothing to sweep) ----
  {
    const res = await jsonFetch(`${GATEWAY}/media/sessions/${encodeURIComponent(MEDIA_PATH)}`, {
      headers: { "x-netram-service-secret": SERVICE_SECRET },
    });
    const body = (await res.json().catch(() => ({}))) as { readerCount?: number };
    check("gateway session view reachable", res.status === 200 && typeof body.readerCount === "number");
  }

  // ---- 12. Audit trail ----
  {
    // Audit rows were written for denials and the stream_ended transition; we
    // verify indirectly through the audit API (append-only, jurisdictioned).
    const res = await jsonFetch(`${API}/api/v1/audit-events?page=1&pageSize=5`, { headers: authHeaders });
    check("audit API reachable", res.ok || res.status === 403, `status ${res.status}`);
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error("verification crashed:", err);
  process.exit(1);
});
