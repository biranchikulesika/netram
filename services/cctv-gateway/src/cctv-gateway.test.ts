import { describe, expect, it, vi } from "vitest";
import { createStreamToken, verifyStreamToken } from "./auth/token.js";
import { buildServer } from "./server.js";
import type { MediamtxClient } from "./mediamtx/client.js";
import {
  SimulatedCameraProvider,
  RtspCameraProvider,
  OnvifCameraProvider,
  HlsCameraProvider,
  ProviderRegistry,
  sanitizeRtspUrl,
} from "./index.js";

const TEST_SECRET = "test-secret-at-least-32-chars-long-12345";
const TEST_SERVICE_SECRET = "test-service-secret-at-least-32-chars";

describe("CCTV Gateway Token Auth", () => {
  it("creates and verifies a valid stream token", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      {
        streamId: "stream-001",
        cameraId: "camera-001",
        mediaPath: "facility-vani/cam-gate",
        exp,
      },
      TEST_SECRET,
    );

    const verified = verifyStreamToken(token, TEST_SECRET);
    expect(verified).not.toBeNull();
    expect(verified?.streamId).toBe("stream-001");
    expect(verified?.cameraId).toBe("camera-001");
    expect(verified?.mediaPath).toBe("facility-vani/cam-gate");
    expect(verified?.exp).toBe(exp);
  });

  it("rejects token with invalid secret", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      {
        streamId: "stream-001",
        cameraId: "camera-001",
        mediaPath: "facility-vani/cam-gate",
        exp,
      },
      TEST_SECRET,
    );

    const verified = verifyStreamToken(token, "wrong-secret-must-be-32-chars-xxxxxxx");
    expect(verified).toBeNull();
  });

  it("rejects tampered token payload", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      {
        streamId: "stream-001",
        cameraId: "camera-001",
        mediaPath: "facility-vani/cam-gate",
        exp,
      },
      TEST_SECRET,
    );

    const [_dataB64, sig] = token.split(".");
    const tamperedData = Buffer.from(
      JSON.stringify({ streamId: "stream-999", cameraId: "camera-999", exp }),
    ).toString("base64url");
    const tamperedToken = `${tamperedData}.${sig}`;

    expect(verifyStreamToken(tamperedToken, TEST_SECRET)).toBeNull();
  });

  it("rejects expired token", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    const token = createStreamToken(
      {
        streamId: "stream-expired",
        cameraId: "camera-001",
        mediaPath: "facility-vani/cam-gate",
        exp: pastExp,
      },
      TEST_SECRET,
    );

    expect(verifyStreamToken(token, TEST_SECRET)).toBeNull();
  });
});

describe("RtspCameraProvider Adapter", () => {
  it("sanitizes RTSP URLs by stripping embedded credentials", () => {
    const clean = sanitizeRtspUrl("rtsp://admin:pass1234@192.168.1.100:554/stream1");
    expect(clean).toBe("rtsp://192.168.1.100:554/stream1");
    expect(clean).not.toContain("admin");
    expect(clean).not.toContain("pass1234");
  });

  it("registers, lists, and queries health for RTSP cameras", async () => {
    const provider = new RtspCameraProvider([
      {
        id: "cctv:rtsp-gate",
        label: "Hostel Main Gate RTSP",
        rtspUrl: "rtsp://camera.internal:554/live/ch0",
        initialStatus: "online",
      },
    ]);

    expect(provider.name).toBe("rtsp");
    const cameras = await provider.listCameras();
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toEqual({
      id: "cctv:rtsp-gate",
      label: "Hostel Main Gate RTSP",
      provider: "rtsp",
      status: "online",
    });

    const health = await provider.cameraHealth("cctv:rtsp-gate");
    expect(health).toBe("online");

    provider.updateCameraStatus("cctv:rtsp-gate", "degraded" as "unknown");
    expect(await provider.cameraHealth("cctv:rtsp-gate")).toBe("degraded");
  });

  it("acquires raw stream and snapshot for RTSP cameras", async () => {
    const provider = new RtspCameraProvider([
      {
        id: "cctv:rtsp-dining",
        label: "Hostel Dining Hall",
        rtspUrl: "rtsp://admin:secret@camera.internal:554/h264",
      },
    ]);

    const rawStream = await provider.acquireRawStream("cctv:rtsp-dining");
    expect(rawStream).toBe("rtsp://admin:secret@camera.internal:554/h264");

    const snapshot = await provider.acquireSnapshot("cctv:rtsp-dining");
    expect(snapshot.contentType).toBe("image/jpeg");
    expect(snapshot.data[0]).toBe(0xff);
    expect(snapshot.data[1]).toBe(0xd8); // JPEG SOI marker
  });

  it("handles unregistering and missing cameras", async () => {
    const provider = new RtspCameraProvider([
      {
        id: "cctv:rtsp-temp",
        label: "Temporary Cam",
        rtspUrl: "rtsp://temp.internal:554/live",
      },
    ]);

    expect(provider.unregisterCamera("cctv:rtsp-temp")).toBe(true);
    expect(await provider.cameraHealth("cctv:rtsp-temp")).toBe("offline");
    await expect(provider.acquireRawStream("cctv:rtsp-temp")).rejects.toThrow("RTSP Camera not found");
  });
});

describe("OnvifCameraProvider Adapter", () => {
  it("registers, lists, and constructs stream URIs for ONVIF cameras", async () => {
    const provider = new OnvifCameraProvider([
      {
        id: "cctv:onvif-corridor",
        label: "Hostel First Floor Corridor",
        hostname: "10.0.1.20",
        port: 8080,
        username: "security_admin",
        password: "CameraPassword#1",
        profileToken: "Profile_HQ",
      },
    ]);

    expect(provider.name).toBe("onvif");
    const cameras = await provider.listCameras();
    expect(cameras).toHaveLength(1);
    expect(cameras[0]?.id).toBe("cctv:onvif-corridor");
    expect(cameras[0]?.provider).toBe("onvif");
    expect(cameras[0]?.status).toBe("online");

    const rawStream = await provider.acquireRawStream("cctv:onvif-corridor");
    expect(rawStream).toContain("rtsp://security_admin:CameraPassword%231@10.0.1.20:8080/onvif/Profile_HQ");

    const snapshot = await provider.acquireSnapshot("cctv:onvif-corridor");
    expect(snapshot.contentType).toBe("image/jpeg");
    expect(snapshot.data.length).toBeGreaterThan(0);
  });
});

describe("HlsCameraProvider Adapter", () => {
  it("registers, lists, and acquires manifest stream for HLS cameras", async () => {
    const provider = new HlsCameraProvider([
      {
        id: "cctv:hls-playground",
        label: "Hostel Playground Feed",
        manifestUrl: "https://streams.netram.local/live/playground.m3u8",
        initialStatus: "online",
      },
    ]);

    expect(provider.name).toBe("hls");
    const cameras = await provider.listCameras();
    expect(cameras).toHaveLength(1);
    expect(cameras[0]?.provider).toBe("hls");

    const rawStream = await provider.acquireRawStream("cctv:hls-playground");
    expect(rawStream).toBe("https://streams.netram.local/live/playground.m3u8");

    const snapshot = await provider.acquireSnapshot("cctv:hls-playground");
    expect(snapshot.contentType).toBe("image/jpeg");
  });
});

describe("ProviderRegistry Composite Adapter", () => {
  it("routes camera operations dynamically across multiple providers", async () => {
    const simulated = new SimulatedCameraProvider();
    const rtsp = new RtspCameraProvider([
      {
        id: "cctv:rtsp-library",
        label: "Hostel Library",
        rtspUrl: "rtsp://library.local:554/main",
      },
    ]);
    const onvif = new OnvifCameraProvider([
      {
        id: "cctv:onvif-entrance",
        label: "Campus Entrance",
        hostname: "192.168.2.5",
        profileToken: "Prof1",
      },
    ]);

    const registry = new ProviderRegistry([simulated, rtsp, onvif]);
    expect(registry.name).toBe("registry");
    expect(registry.listProviders()).toHaveLength(3);

    // Aggregates provider-side cameras (simulated has NO catalog by design -
    // the DB is the camera source of truth; it only resolves the rig source).
    const cameras = await registry.listCameras();
    expect(cameras.map((c) => c.id)).toContain("cctv:rtsp-library"); // from rtsp
    expect(cameras.map((c) => c.id)).toContain("cctv:onvif-entrance"); // from onvif

    // Routes health to the claiming provider; unclaimed cameras use the
    // configured default (simulated resolver reports "unknown" - real health
    // comes from media state, not provider presence).
    expect(await registry.cameraHealth("cctv:rtsp-library")).toBe("online");
    expect(await registry.cameraHealth("cctv:onvif-entrance")).toBe("online");

    // Routes raw sources
    const rtspStream = await registry.acquireRawStream("cctv:rtsp-library");
    expect(rtspStream).toBe("rtsp://library.local:554/main");

    // Routes snapshots
    const snap = await registry.acquireSnapshot("cctv:onvif-entrance");
    expect(snap.contentType).toBe("image/jpeg");
  });

  it("falls back to the default provider for unclaimed cameras (dev rig)", async () => {
    const simulated = new SimulatedCameraProvider();
    const registry = new ProviderRegistry([simulated]).setDefaultProvider("simulated");

    // No provider claims this DB camera; the default resolves its source.
    const source = await registry.acquireRawStream("some-db-camera-uuid");
    expect(source).toBe("rtsp://facility-nvr:8554/facility-vani/cam-gate");
    expect(await registry.cameraHealth("some-db-camera-uuid")).toBe("unknown");
  });

  it("fails closed for unknown cameras when no default provider is set", async () => {
    const registry = new ProviderRegistry([]);
    await expect(registry.acquireRawStream("unknown-camera")).rejects.toThrow(
      "No camera provider found",
    );
    expect(await registry.cameraHealth("unknown-camera")).toBe("offline");
  });

  it("supports dynamic unregistration of providers", async () => {
    const hls = new HlsCameraProvider([
      {
        id: "cctv:hls-gate",
        label: "Gate HLS",
        manifestUrl: "https://hls.local/gate.m3u8",
      },
    ]);
    const registry = new ProviderRegistry([hls]);
    expect(await registry.cameraHealth("cctv:hls-gate")).toBe("online");

    expect(registry.unregisterProvider("hls")).toBe(true);
    expect(await registry.cameraHealth("cctv:hls-gate")).toBe("offline");
    await expect(registry.acquireRawStream("cctv:hls-gate")).rejects.toThrow("No camera provider found");
  });
});

const RIG_CAMERA = {
  id: "a8ccb317-76ab-5106-ac47-5bc1dc568967",
  provider: "simulated",
  protocol: "rtsp",
  endpoint: "rtsp://facility-nvr:8554/facility-vani/cam-gate",
};

const PATH_STATE_ONLINE = {
  name: "facility-vani/cam-gate",
  confName: "facility-vani/cam-gate",
  ready: true,
  readyTime: "2026-09-23T12:00:00Z",
  available: true,
  availableTime: "2026-09-23T12:00:00Z",
  online: true,
  source: { type: "rtspSource", id: "" },
  tracks: ["H264"],
  readers: [],
  bytesReceived: 0,
  bytesSent: 0,
};

/** MediaMTX stub: controllable per-test path state. */
function mediamtxStub(pathState: unknown | null, opts: { fail?: boolean } = {}) {
  return {
    ensurePath: vi.fn().mockResolvedValue({ created: true }),
    getPath: vi.fn().mockImplementation(() =>
      opts.fail ? Promise.reject(new Error("unreachable")) : Promise.resolve(pathState),
    ),
    getPathStats: vi.fn().mockImplementation(() => {
      if (opts.fail) return Promise.reject(new Error("unreachable"));
      if (pathState === null) return Promise.resolve(null);
      const p = pathState as typeof PATH_STATE_ONLINE;
      return Promise.resolve({
        exists: true,
        ready: p.ready,
        available: p.available,
        online: p.online,
        readerCount: p.readers.length,
        readers: p.readers,
        sourceType: p.source.type,
        bytesSent: p.bytesSent,
      });
    }),
    listPaths: vi.fn().mockResolvedValue(pathState ? [pathState] : []),
    kickReader: vi.fn().mockResolvedValue(true),
    listWebRtcSessions: vi.fn().mockResolvedValue([]),
    checkHealth: vi.fn().mockResolvedValue(opts.fail ? { ok: false } : { ok: true }),
  };
}

describe("CCTV Gateway Server (media control bridge)", () => {
  it("responds to /health with the bridge role", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(PATH_STATE_ONLINE) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("ok");
    expect(json.role).toBe("media-control-bridge");
    await server.close();
  });

  it("reports media control plane availability", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(null, { fail: true }) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({ method: "GET", url: "/media/health" });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("unavailable");
    expect(json.mediamtx).toBe("unreachable");
    await server.close();
  });

  it("lists provider-side cameras (dev/diagnostics only)", async () => {
    const registry = new ProviderRegistry([
      new RtspCameraProvider([
        { id: "cctv:external-rtsp", label: "Perimeter", rtspUrl: "rtsp://p:554/live" },
      ]),
    ]);
    const server = await buildServer({
      provider: registry,
      mediamtxClient: mediamtxStub(null) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({ method: "GET", url: "/cameras" });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.cameras.map((c: { id: string }) => c.id)).toContain("cctv:external-rtsp");
    await server.close();
  });

  it("derives REAL health from MediaMTX state (context-driven)", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(PATH_STATE_ONLINE) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({
      method: "POST",
      url: "/cameras/health",
      headers: { "x-netram-service-secret": TEST_SERVICE_SECRET },
      payload: RIG_CAMERA,
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("online");
    expect(json.details.mediaPath).toBe("facility-vani/cam-gate");
    await server.close();
  });

  it("rejects control-plane calls without the service secret", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(PATH_STATE_ONLINE) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({
      method: "POST",
      url: "/cameras/health",
      payload: RIG_CAMERA,
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe("UNAUTHORIZED_SERVICE");
    await server.close();
  });

  it("reports offline when MediaMTX is unreachable (no fake online)", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(PATH_STATE_ONLINE, { fail: true }) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({
      method: "POST",
      url: "/cameras/health",
      headers: { "x-netram-service-secret": TEST_SERVICE_SECRET },
      payload: RIG_CAMERA,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe("offline");
    await server.close();
  });

  it("exposes media statistics for a camera path", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(PATH_STATE_ONLINE) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({
      method: "POST",
      url: "/cameras/stats",
      headers: { "x-netram-service-secret": TEST_SERVICE_SECRET },
      payload: RIG_CAMERA,
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.exists).toBe(true);
    expect(json.sourceType).toBe("rtspSource");
    expect(json.mediaPath).toBe("facility-vani/cam-gate");
    await server.close();
  });

  it("prepares a WHEP playback contract with signed token (no MPEG-TS relay)", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(null) as unknown as MediamtxClient,
      config: {
        streamSecret: TEST_SECRET,
        serviceSecret: TEST_SERVICE_SECRET,
        mediamtxWhepPublicUrl: "http://localhost:8189",
      },
    });
    const res = await server.inject({
      method: "POST",
      url: `/cameras/${RIG_CAMERA.id}/streams`,
      headers: { "x-netram-service-secret": TEST_SERVICE_SECRET },
      payload: { ttlSeconds: 120, ...RIG_CAMERA },
    });
    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.playback.protocol).toBe("webrtc");
    expect(json.playback.whepUrl).toBe("http://localhost:8189/facility-vani/cam-gate/whep");
    expect(json.playback.mediaPath).toBe("facility-vani/cam-gate");
    expect(json.streamUrl).toBe(json.playback.whepUrl);
    expect(json.token).toBeDefined();
    expect(new Date(json.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // No ingest details may leak into the browser-facing contract.
    expect(JSON.stringify(json)).not.toContain("facility-nvr:8554");
    await server.close();
  });

  it("rejects stream requests with missing or mismatched camera context", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(null) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({
      method: "POST",
      url: `/cameras/${RIG_CAMERA.id}/streams`,
      headers: { "x-netram-service-secret": TEST_SERVICE_SECRET },
      payload: { ttlSeconds: 120, id: "other-id", provider: "simulated", protocol: "rtsp", endpoint: "rtsp://x/y" },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_CAMERA_CONTEXT");
    await server.close();
  });

  it("validates signed playback tokens on /streams/:streamId", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(null) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const createRes = await server.inject({
      method: "POST",
      url: `/cameras/${RIG_CAMERA.id}/streams`,
      headers: { "x-netram-service-secret": TEST_SERVICE_SECRET },
      payload: { ttlSeconds: 60, ...RIG_CAMERA },
    });
    const { streamId, token } = JSON.parse(createRes.body);

    const okRes = await server.inject({
      method: "GET",
      url: `/streams/${streamId}?token=${token}&cameraId=${RIG_CAMERA.id}`,
    });
    expect(okRes.statusCode).toBe(200);
    expect(JSON.parse(okRes.body).valid).toBe(true);

    const badRes = await server.inject({
      method: "GET",
      url: `/streams/${streamId}?token=bad.token`,
    });
    expect(badRes.statusCode).toBe(401);

    const noTokRes = await server.inject({
      method: "GET",
      url: `/streams/${streamId}`,
    });
    expect(noTokRes.statusCode).toBe(401);
    expect(JSON.parse(noTokRes.body).error.code).toBe("UNAUTHORIZED");
    await server.close();
  });

  it("serves JPEG camera snapshots for advisory AI inference", async () => {
    const server = await buildServer({
      mediamtxClient: mediamtxStub(null) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({
      method: "GET",
      url: `/cameras/${RIG_CAMERA.id}/snapshot`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    const buf = Buffer.from(res.rawPayload);
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    expect(buf[buf.length - 2]).toBe(0xff);
    expect(buf[buf.length - 1]).toBe(0xd9);
    await server.close();
  });

  it("returns 404 CAMERA_NOT_FOUND on snapshot when no provider resolves the camera", async () => {
    const registry = new ProviderRegistry([]);
    const server = await buildServer({
      provider: registry,
      mediamtxClient: mediamtxStub(null) as unknown as MediamtxClient,
      config: { streamSecret: TEST_SECRET, serviceSecret: TEST_SERVICE_SECRET },
    });
    const res = await server.inject({
      method: "GET",
      url: "/cameras/unknown-id-xyz/snapshot",
    });
    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe("CAMERA_NOT_FOUND");
    await server.close();
  });
});
