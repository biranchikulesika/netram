import { describe, expect, it } from "vitest";
import { createStreamToken, verifyStreamToken } from "./auth/token.js";
import { buildServer } from "./server.js";

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

describe("CCTV Gateway Server", () => {
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

  it("lists simulated cameras", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const res = await server.inject({
      method: "GET",
      url: "/cameras",
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(Array.isArray(json.cameras)).toBe(true);
    expect(json.cameras.length).toBeGreaterThanOrEqual(2);
    await server.close();
  });

  it("returns camera health", async () => {
    const server = await buildServer({ config: { streamSecret: TEST_SECRET } });
    const res = await server.inject({
      method: "GET",
      url: "/cameras/cctv:vani-gate/health",
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.cameraId).toBe("cctv:vani-gate");
    expect(json.status).toBe("online");
    expect(typeof json.latencyMs).toBe("number");
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
    // Verify JPEG SOI and EOI markers
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    expect(buf[buf.length - 2]).toBe(0xff);
    expect(buf[buf.length - 1]).toBe(0xd9);
    await server.close();
  });
});
