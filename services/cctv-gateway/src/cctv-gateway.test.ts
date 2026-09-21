import { describe, expect, it } from "vitest";
import { createStreamToken, verifyStreamToken } from "./auth/token.js";
import { buildServer } from "./server.js";
import {
  SimulatedCameraProvider,
  RtspCameraProvider,
  OnvifCameraProvider,
  HlsCameraProvider,
  ProviderRegistry,
  sanitizeRtspUrl,
} from "./index.js";

const TEST_SECRET = "test-secret-at-least-32-chars-long-12345";

describe("CCTV Gateway Token Auth", () => {
  it("creates and verifies a valid stream token", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      {
        streamId: "stream-001",
        cameraId: "camera-001",
        exp,
      },
      TEST_SECRET,
    );

    const verified = verifyStreamToken(token, TEST_SECRET);
    expect(verified).not.toBeNull();
    expect(verified?.streamId).toBe("stream-001");
    expect(verified?.cameraId).toBe("camera-001");
    expect(verified?.exp).toBe(exp);
  });

  it("rejects token with invalid secret", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = createStreamToken(
      {
        streamId: "stream-001",
        cameraId: "camera-001",
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

    // Aggregates cameras across all registered providers
    const cameras = await registry.listCameras();
    expect(cameras.length).toBeGreaterThanOrEqual(4);
    expect(cameras.map((c) => c.id)).toContain("cctv:vani-gate"); // from simulated
    expect(cameras.map((c) => c.id)).toContain("cctv:rtsp-library"); // from rtsp
    expect(cameras.map((c) => c.id)).toContain("cctv:onvif-entrance"); // from onvif

    // Routes health checks to respective provider
    expect(await registry.cameraHealth("cctv:vani-gate")).toBe("online");
    expect(await registry.cameraHealth("cctv:rtsp-library")).toBe("online");
    expect(await registry.cameraHealth("cctv:nonexistent")).toBe("offline");

    // Routes raw streams
    const simStream = await registry.acquireRawStream("cctv:vani-gate");
    expect(simStream).toContain("rtsp://simulated.internal:8554");
    const rtspStream = await registry.acquireRawStream("cctv:rtsp-library");
    expect(rtspStream).toBe("rtsp://library.local:554/main");

    // Routes snapshots
    const snap = await registry.acquireSnapshot("cctv:onvif-entrance");
    expect(snap.contentType).toBe("image/jpeg");
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

describe("CCTV Gateway Server with Multi-Provider Registry", () => {
  it("responds to /health", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const res = await server.inject({
      method: "GET",
      url: "/health",
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("ok");
    expect(json.service).toBe("cctv-gateway");
    await server.close();
  });

  it("lists cameras across multiple registered providers", async () => {
    const registry = new ProviderRegistry([
      new SimulatedCameraProvider(),
      new RtspCameraProvider([
        {
          id: "cctv:external-rtsp",
          label: "External Perimeter Cam",
          rtspUrl: "rtsp://perimeter.internal:554/live",
        },
      ]),
    ]);

    const server = await buildServer({
      provider: registry,
      config: { streamSecret: TEST_SECRET },
    });

    const res = await server.inject({
      method: "GET",
      url: "/cameras",
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(Array.isArray(json.cameras)).toBe(true);
    const ids = json.cameras.map((c: { id: string }) => c.id);
    expect(ids).toContain("cctv:vani-gate");
    expect(ids).toContain("cctv:external-rtsp");
    await server.close();
  });

  it("returns camera health for cameras on different providers", async () => {
    const registry = new ProviderRegistry([
      new SimulatedCameraProvider(),
      new RtspCameraProvider([
        {
          id: "cctv:external-rtsp",
          label: "External Perimeter Cam",
          rtspUrl: "rtsp://perimeter.internal:554/live",
          initialStatus: "online",
        },
      ]),
    ]);

    const server = await buildServer({
      provider: registry,
      config: { streamSecret: TEST_SECRET },
    });

    const res = await server.inject({
      method: "GET",
      url: "/cameras/cctv:external-rtsp/health",
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.cameraId).toBe("cctv:external-rtsp");
    expect(json.status).toBe("online");
    await server.close();
  });

  it("issues authorized stream relay with signed HMAC token", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const res = await server.inject({
      method: "POST",
      url: "/cameras/cctv:vani-gate/streams",
      payload: { ttlSeconds: 120 },
    });
    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.streamId).toBeDefined();
    expect(json.cameraId).toBe("cctv:vani-gate");
    expect(json.token).toBeDefined();
    expect(json.streamUrl).toContain(`/streams/${json.streamId}?token=${json.token}`);
    expect(new Date(json.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await server.close();
  });

  it("allows access to stream relay with valid signed token", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const createRes = await server.inject({
      method: "POST",
      url: "/cameras/cctv:vani-gate/streams",
      payload: { ttlSeconds: 60 },
    });
    const { streamId, token } = JSON.parse(createRes.body);

    const streamRes = await server.inject({
      method: "GET",
      url: `/streams/${streamId}?token=${token}`,
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.headers["content-type"]).toBe("video/mp2t");
    const buf = Buffer.from(streamRes.rawPayload);
    expect(buf.length).toBe(188);
    expect(buf[0]).toBe(0x47); // MPEG-TS Sync byte
    await server.close();
  });

  it("rejects unauthorized stream access without token", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const res = await server.inject({
      method: "GET",
      url: "/streams/any-stream-id",
    });
    expect(res.statusCode).toBe(401);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe("UNAUTHORIZED");
    await server.close();
  });

  it("rejects unauthorized stream access with invalid or mismatched token", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const res = await server.inject({
      method: "GET",
      url: "/streams/stream-123?token=invalid.token",
    });
    expect(res.statusCode).toBe(401);
    await server.close();
  });

  it("serves JPEG camera snapshots for advisory AI inference", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const res = await server.inject({
      method: "GET",
      url: "/cameras/cctv:vani-gate/snapshot",
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

  it("returns 404 CAMERA_NOT_FOUND on snapshot for unknown camera", async () => {
    const registry = new ProviderRegistry([new SimulatedCameraProvider()]);
    const server = await buildServer({
      provider: registry,
      config: { streamSecret: TEST_SECRET },
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
