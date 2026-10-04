import { describe, expect, it, vi } from "vitest";
import { MediamtxClient, MediamtxError } from "./client.js";
import { deriveMediaPath, resolveIngestSource } from "./media-path.js";
import { MediaControlService } from "./media-control-service.js";
import { createStreamToken } from "../auth/token.js";
import type { CameraProvider } from "../providers/provider.js";

const PATH_STATE_READY = {
  name: "facility-vani/cam-gate",
  confName: "facility-vani/cam-gate",
  ready: true,
  readyTime: "2026-09-23T12:00:00Z",
  available: true,
  availableTime: "2026-09-23T12:00:00Z",
  online: true,
  source: { type: "rtspSource", id: "" },
  tracks: ["H264"],
  readers: [{ type: "webRTCSession", id: "s1" }],
  bytesReceived: 1000,
  bytesSent: 2000,
};

const PATH_STATE_IDLE = {
  ...PATH_STATE_READY,
  ready: false,
  readyTime: null,
  available: false,
  availableTime: null,
  readers: [],
  bytesSent: 0,
};

const PATH_STATE_HAS_HISTORY = {
  ...PATH_STATE_IDLE,
  readyTime: "2026-09-23T11:00:00Z",
  availableTime: "2026-09-23T11:00:00Z",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ------------------------------------------------------------ MediaMTX client

describe("MediamtxClient", () => {
  it("ensurePath succeeds when MediaMTX accepts provisioning", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      username: "u",
      password: "p",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const result = await client.ensurePath("facility-vani/cam-gate", {
      source: "rtsp://nvr:8554/x",
    });
    expect(result.created).toBe(true);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://mediamtx.test/v3/config/paths/add/facility-vani%2Fcam-gate");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    const payload = JSON.parse(String(init.body));
    expect(payload.source).toBe("rtsp://nvr:8554/x");
    expect(payload.sourceOnDemand).toBe(true);
  });

  it("ensurePath is idempotent when the path already exists (400)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { status: "error", error: "path already exists" }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const result = await client.ensurePath("some-path", { source: "publisher" });
    expect(result.created).toBe(false);
  });

  it("getPath returns state for an existing path", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, PATH_STATE_READY));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const state = await client.getPath("facility-vani/cam-gate");
    expect(state?.ready).toBe(true);
    expect(state?.readers).toHaveLength(1);
  });

  it("getPath returns null for an unknown path (404)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { status: "error", error: "path not found" }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(await client.getPath("does-not-exist")).toBeNull();
  });

  it("getPathStats reports reader count correctly", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, PATH_STATE_READY));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const stats = await client.getPathStats("facility-vani/cam-gate");
    expect(stats?.exists).toBe(true);
    expect(stats?.readerCount).toBe(1);
    expect(stats?.sourceType).toBe("rtspSource");
    expect(stats?.bytesSent).toBe(2000);
  });

  it("getPathStats returns null for unknown path", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { status: "error", error: "path not found" }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await client.getPathStats("nope")).toBeNull();
  });

  it("health/control calls fail in a controlled way when MediaMTX is unavailable", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const health = await client.checkHealth();
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("unreachable");

    await expect(client.listPaths()).rejects.toBeInstanceOf(MediamtxError);
  });

  it("kickReader returns true on success and false when session is gone", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok" }))
      .mockResolvedValueOnce(jsonResponse(404, { status: "error", error: "session not found" }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(await client.kickReader("11111111-1111-1111-1111-111111111111")).toBe(true);
    expect(await client.kickReader("22222222-2222-2222-2222-222222222222")).toBe(false);
  });
});

// ---------------------------------------------------------------- media path

describe("media path derivation", () => {
  const base = { provider: "simulated", protocol: "rtsp" };

  it("derives the media path from the endpoint path segment", () => {
    expect(
      deriveMediaPath({ ...base, endpoint: "rtsp://facility-nvr:8554/facility-vani/cam-gate" }),
    ).toBe("facility-vani/cam-gate");
  });

  it("rejects non-RTSP protocols and invalid endpoints (fails closed)", () => {
    expect(() => deriveMediaPath({ ...base, protocol: "hls", endpoint: "http://x/y" })).toThrow();
    expect(() => deriveMediaPath({ ...base, endpoint: "not a url" })).toThrow();
    expect(() => deriveMediaPath({ ...base, endpoint: "rtsp://host:554" })).toThrow();
    expect(() => deriveMediaPath({ ...base, endpoint: "rtsp://host/with spaces%20/x" })).toThrow();
  });
});

describe("ingest source resolution", () => {
  const camera = {
    id: "cam-1",
    provider: "simulated",
    protocol: "rtsp",
    endpoint: "rtsp://facility-nvr:8554/facility-vani/cam-gate",
  };

  it("prefers the dev override when configured", () => {
    expect(resolveIngestSource(camera, "rtsp://override:8554/feed")).toBe(
      "rtsp://override:8554/feed",
    );
  });

  it("falls back to the DB endpoint (server-side credentials only)", () => {
    expect(resolveIngestSource(camera, "")).toBe(camera.endpoint);
  });
});

// ---------------------------------------------------------------- health logic

function buildService(mediamtxMock: {
  getPath: ReturnType<typeof vi.fn>;
  ensurePath?: ReturnType<typeof vi.fn>;
  kickReadersByNetramSession?: ReturnType<typeof vi.fn>;
}): MediaControlService {
  const provider: CameraProvider = {
    name: "simulated",
    listCameras: async () => [],
    cameraHealth: async () => "unknown",
    acquireRawStream: async () => "rtsp://facility-nvr:8554/facility-vani/cam-gate",
    acquireSnapshot: async () => ({ contentType: "image/jpeg", data: Buffer.alloc(1) }),
  };
  return new MediaControlService({
    mediamtx: mediamtxMock as unknown as MediamtxClient,
    providers: provider,
    whepPublicUrl: "http://localhost:8189",
    devIngestSource: "",
    streamSecret: "test-secret-at-least-32-chars-long-12345",
  });
}

const CAMERA = {
  id: "11111111-2222-3333-4444-555555555555",
  provider: "simulated",
  protocol: "rtsp",
  endpoint: "rtsp://facility-nvr:8554/facility-vani/cam-gate",
};

describe("MediaControlService health (from real media state)", () => {
  it("reports online when the source is connected and ready", async () => {
    const svc = buildService({ getPath: vi.fn().mockResolvedValue(PATH_STATE_READY) });
    const health = await svc.cameraHealth(CAMERA);
    expect(health.status).toBe("online");
    expect(health.details.mediaPath).toBe("facility-vani/cam-gate");
    expect(health.details.readers).toBe(1);
  });

  it("reports degraded when the source stopped after having delivered", async () => {
    const svc = buildService({ getPath: vi.fn().mockResolvedValue(PATH_STATE_HAS_HISTORY) });
    const health = await svc.cameraHealth(CAMERA);
    expect(health.status).toBe("degraded");
    expect(health.details.reason).toBe("not_ready_has_history");
  });

  it("reports offline when the source never delivered or path is missing", async () => {
    const idle = buildService({ getPath: vi.fn().mockResolvedValue(PATH_STATE_IDLE) });
    expect((await idle.cameraHealth(CAMERA)).status).toBe("offline");

    const missing = buildService({ getPath: vi.fn().mockResolvedValue(null) });
    const health = await missing.cameraHealth(CAMERA);
    expect(health.status).toBe("offline");
    expect(health.details.reason).toBe("path_not_provisioned");
  });

  it("reports offline when MediaMTX itself is unreachable", async () => {
    const svc = buildService({
      getPath: vi.fn().mockRejectedValue(new MediamtxError("unreachable", undefined)),
    });
    const health = await svc.cameraHealth(CAMERA);
    expect(health.status).toBe("offline");
    expect(health.details.reason).toBe("mediamtx_unreachable");
  });
});

describe("MediaControlService playback preparation", () => {
  it("provisions the path and mints a browser-facing WHEP contract with no ingest details", async () => {
    const ensurePath = vi.fn().mockResolvedValue({ created: true });
    const svc = buildService({
      getPath: vi.fn().mockResolvedValue(null),
      ensurePath,
    });
    const playback = await svc.preparePlayback(CAMERA, {
      streamId: "stream-1",
      token: "tok",
      expiresAt: "2026-09-23T13:00:00Z",
    });

    expect(playback.protocol).toBe("webrtc");
    expect(playback.whepUrl).toBe("http://localhost:8189/facility-vani/cam-gate/whep");
    expect(playback.mediaPath).toBe("facility-vani/cam-gate");
    const payload = ensurePath.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.source).toBe("rtsp://facility-nvr:8554/facility-vani/cam-gate");
    expect(payload.sourceOnDemand).toBe(true);
  });

  it("fails closed for cameras whose endpoint cannot yield a media path", async () => {
    const ensurePath = vi.fn();
    const svc = buildService({ getPath: vi.fn(), ensurePath });
    await expect(
      svc.preparePlayback(
        { ...CAMERA, endpoint: "rtsp://host:554" },
        { streamId: "s", token: "t", expiresAt: "x" },
      ),
    ).rejects.toThrow(/valid media path/);
    expect(ensurePath).not.toHaveBeenCalled();
  });
});

describe("MediaControlService playback-token verification (Phase 4)", () => {
  const SECRET = "test-secret-at-least-32-chars-long-12345";

  function serviceWithSecret(getPath: ReturnType<typeof vi.fn>): MediaControlService {
    // buildService injects SECRET; this wrapper exists to keep the
    // test's dependency on that secret explicit and grep-able.
    return buildService({ getPath });
  }

  it("accepts a valid token whose media path still exists", async () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      { streamId: "stream-1", cameraId: CAMERA.id, mediaPath: "facility-vani/cam-gate", exp },
      SECRET,
    );
    const svc = serviceWithSecret(vi.fn().mockResolvedValue(PATH_STATE_READY));
    const result = await svc.verifyPlaybackToken(token);

    expect(result).toEqual(
      expect.objectContaining({ valid: true, mediaPath: "facility-vani/cam-gate" }),
    );
  });

  it("rejects a signature-valid token whose media path is gone", async () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      { streamId: "stream-1", cameraId: CAMERA.id, mediaPath: "gone/path", exp },
      SECRET,
    );
    const svc = serviceWithSecret(vi.fn().mockResolvedValue(null));
    const result = await svc.verifyPlaybackToken(token);

    expect(result).toEqual({ valid: false, reason: "media_path_not_provisioned" });
  });

  it("rejects garbage tokens without touching MediaMTX", async () => {
    const getPath = vi.fn();
    const svc = buildService({ getPath });
    const result = await svc.verifyPlaybackToken("not-a-real-token");

    expect(result).toEqual({ valid: false, reason: "invalid_or_expired_token" });
    expect(getPath).not.toHaveBeenCalled();
  });

  it("rejects when MediaMTX is unreachable (fail-closed)", async () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      { streamId: "stream-1", cameraId: CAMERA.id, mediaPath: "facility-vani/cam-gate", exp },
      SECRET,
    );
    const svc = buildService({
      getPath: vi.fn().mockRejectedValue(new MediamtxError("unreachable", undefined)),
    });
    const result = await svc.verifyPlaybackToken(token);

    expect(result.valid).toBe(false);
    expect((result as { reason: string }).reason).toContain("mediamtx_unreachable");
  });
});

describe("MediaControlService session view (Phase 4)", () => {
  it("reports the live reader count for a path", async () => {
    const svc = buildService({ getPath: vi.fn().mockResolvedValue(PATH_STATE_READY) });
    const view = await svc.sessionView("facility-vani/cam-gate");
    expect(view).toEqual({
      mediaPath: "facility-vani/cam-gate",
      readerCount: 1,
      ready: true,
    });
  });

  it("reports zero readers for a missing path (no throw)", async () => {
    const svc = buildService({ getPath: vi.fn().mockResolvedValue(null) });
    const view = await svc.sessionView("missing/path");
    expect(view).toEqual({ mediaPath: "missing/path", readerCount: 0, ready: false });
  });
});

describe("reader correlation (Phase 5)", () => {
  const SESSIONS = [
    { id: "reader-1", path: "facility-vani/cam-gate", query: "token=t&netramSession=sess-A" },
    { id: "reader-2", path: "facility-vani/cam-gate", query: "token=t&netramSession=sess-B" },
    { id: "reader-3", path: "other/path", query: "token=t&netramSession=sess-A" },
    { id: "reader-4", path: "facility-vani/cam-gate", query: "" },
  ];

  it("kickReadersByNetramSession kicks exactly the readers whose query echoes the NETRAM session", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { itemCount: SESSIONS.length, items: SESSIONS }))
      .mockImplementation(async () => jsonResponse(200, { status: "ok" }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const kicked = await client.kickReadersByNetramSession("sess-A");
    expect(kicked).toBe(2);
    const kickCalls = fetchFn.mock.calls.filter((c) => String(c[0]).includes("/kick/"));
    expect(kickCalls.map((c) => String(c[0]))).toEqual([
      "http://mediamtx.test/v3/webrtcsessions/kick/reader-1",
      "http://mediamtx.test/v3/webrtcsessions/kick/reader-3",
    ]);
  });

  it("kickReadersByNetramSession returns 0 when no reader matches (no kick calls)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { itemCount: 1, items: [SESSIONS[3]] }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const kicked = await client.kickReadersByNetramSession("sess-Z");
    expect(kicked).toBe(0);
  });

  it("kickReadersByNetramSession surfaces MediaMTX failure (no silent swallow)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(500, { error: "boom" }));
    const client = new MediamtxClient({
      baseUrl: "http://mediamtx.test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(client.kickReadersByNetramSession("sess-A")).rejects.toBeInstanceOf(MediamtxError);
  });

  it("MediaControlService.kickSessionReaders delegates to the client", async () => {
    const svc = buildService({
      getPath: vi.fn(),
      kickReadersByNetramSession: vi.fn().mockResolvedValue(1),
    });
    const kicked = await svc.kickSessionReaders("sess-B");
    expect(kicked).toBe(1);
  });
});
