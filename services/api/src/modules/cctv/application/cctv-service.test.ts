import { createHash } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CctvService } from "./cctv-service.js";
import type { CctvCamera, CctvStreamSession } from "@netram/types";
import type { CctvRepositoryPort } from "./ports/cctv-repository.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { AppError } from "../../../infrastructure/errors.js";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-khordha",
    user: {
      id: "user-officer-khordha",
      email: "officer.khordha@netram.gov.in",
      displayName: "District Officer Khordha",
      type: "netram",
    },
    permissions: new Set(["cctv:read", "cctv:stream"]),
    assignments: [],
    requestId: "req-cctv-001",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

const mockCamera1: CctvCamera = {
  id: "cam-khordha-1",
  name: "Vani Vihar Gate",
  provider: "simulated",
  protocol: "rtsp",
  endpoint: "rtsp://simulated.internal:8554/live/vani-gate",
  districtId: "district-khordha",
  projectId: "project-vani",
  status: "active",
  createdAt: "2026-02-11T00:00:00.000Z",
  updatedAt: "2026-02-11T00:00:00.000Z",
};

const mockCamera2: CctvCamera = {
  id: "cam-cuttack-1",
  name: "Cuttack Hostel Gate",
  provider: "simulated",
  protocol: "rtsp",
  endpoint: "rtsp://simulated.internal:8554/live/cuttack-hostel",
  districtId: "district-cuttack",
  projectId: null,
  status: "active",
  createdAt: "2026-02-11T00:00:00.000Z",
  updatedAt: "2026-02-11T00:00:00.000Z",
};

describe("CctvService", () => {
  let mockAuthz: AuthorizationService;
  let mockRepo: CctvRepositoryPort;
  let service: CctvService;

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["district-khordha"])),
      canAccessDistrict: vi.fn((_ctx, distId) => distId === "district-khordha"),
    } as unknown as AuthorizationService;

    mockRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "cam-khordha-1") return mockCamera1;
        if (id === "cam-cuttack-1") return mockCamera2;
        return null;
      }),
      list: vi.fn().mockResolvedValue({
        items: [mockCamera1],
        total: 1,
      }),
      createStreamSession: vi.fn().mockResolvedValue({
        id: "sess-1",
        cameraId: "cam-khordha-1",
        sessionId: "stream-001",
        status: "active",
        startedAt: "2026-02-11T00:00:00.000Z",
        endedAt: null,
        createdAt: "2026-02-11T00:00:00.000Z",
        mediaPath: "facility-vani/cam-gate",
        lastHeartbeatAt: "2026-02-11T00:00:00.000Z",
        expiresAt: "2026-02-11T00:05:00.000Z",
        endedBy: null,
        endReason: null,
      } satisfies CctvStreamSession),
      endStreamSession: vi.fn().mockResolvedValue(undefined),
      touchHeartbeatBySessionId: vi.fn().mockResolvedValue(true),
      findActiveSessionByTokenHash: vi.fn().mockResolvedValue(null),
      findActiveSessionBySessionId: vi.fn().mockResolvedValue(null),
      countActiveByCamera: vi.fn().mockResolvedValue(0),
      findSweepCandidates: vi.fn().mockResolvedValue([]),
      endStreamSessionById: vi.fn().mockResolvedValue(false),
    };

    service = new CctvService(mockAuthz, mockRepo, "http://localhost:3003", "test-service-secret-at-least-32-chars");
  });

  it("lists cameras and strictly sanitizes raw endpoints (§7, §42)", async () => {
    const ctx = mockCtx();
    const result = await service.listCameras(ctx, {});

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "cctv:read");
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.id).toBe("cam-khordha-1");
    expect(result.items[0]!.name).toBe("Vani Vihar Gate");
    // Crucial architectural rule: endpoint must NOT be present on public representation
    expect((result.items[0] as unknown as Record<string, unknown>).endpoint).toBeUndefined();
  });

  it("gets camera details and enforces jurisdiction access", async () => {
    const ctx = mockCtx();
    const camera = await service.getCamera(ctx, "cam-khordha-1");
    expect(camera.id).toBe("cam-khordha-1");
    expect((camera as unknown as Record<string, unknown>).endpoint).toBeUndefined();

    // Denies access to camera in Cuttack when user only has Khordha jurisdiction
    await expect(service.getCamera(ctx, "cam-cuttack-1")).rejects.toThrow(
      /Access denied to camera outside authorized jurisdiction/,
    );
  });

  it("throws 404 when camera does not exist", async () => {
    const ctx = mockCtx();
    await expect(service.getCamera(ctx, "cam-non-existent")).rejects.toThrow(AppError);
  });

  it("requests authorized stream, persists session, and creates audit and outbox events", async () => {
    const ctx = mockCtx();

    // Mock global fetch for gateway call
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-relay-001",
        cameraId: "cam-khordha-1",
        streamUrl: "http://localhost:3003/streams/stream-relay-001?token=test-token",
        expiresAt: "2026-02-11T00:05:00.000Z",
        token: "test-token",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const stream = await service.requestCameraStream(ctx, "cam-khordha-1", { ttlSeconds: 300 });

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "cctv:stream");
    expect(stream.streamId).toBe("stream-relay-001");
    expect(stream.streamUrl).toBe(
      "http://localhost:3003/streams/stream-relay-001?token=test-token",
    );

    // Verifies stream session persistence with audit log and outbox event
    expect(mockRepo.createStreamSession).toHaveBeenCalledWith(
      {
        cameraId: "cam-khordha-1",
        sessionId: "stream-relay-001",
        mediaPath: undefined,
        tokenHash: expect.any(String),
        expiresAt: "2026-02-11T00:05:00.000Z",
      },
      expect.objectContaining({
        actorUserId: "user-officer-khordha",
        auditAction: "cctv.accessed",
        eventType: "cctv.stream_started",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("rejects stream request for camera outside jurisdiction", async () => {
    const ctx = mockCtx();
    await expect(
      service.requestCameraStream(ctx, "cam-cuttack-1", { ttlSeconds: 300 }),
    ).rejects.toThrow(/Access denied to camera outside authorized jurisdiction/);
  });

  it("persists the media path and token hash on stream creation (Phase 4)", async () => {
    const ctx = mockCtx();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          streamId: "stream-relay-001",
          cameraId: "cam-khordha-1",
          streamUrl: "http://localhost:8189/facility-vani/cam-gate/whep",
          expiresAt: "2026-02-11T00:05:00.000Z",
          token: "playback-token-abc",
          playback: {
            protocol: "webrtc",
            whepUrl: "http://localhost:8189/facility-vani/cam-gate/whep",
            token: "playback-token-abc",
            mediaPath: "facility-vani/cam-gate",
          },
        }),
      }),
    );

    await service.requestCameraStream(ctx, "cam-khordha-1", { ttlSeconds: 300 });

    expect(mockRepo.createStreamSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaPath: "facility-vani/cam-gate",
        tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        expiresAt: "2026-02-11T00:05:00.000Z",
      }),
      expect.objectContaining({ auditAction: "cctv.accessed" }),
    );
    vi.unstubAllGlobals();
  });
});

describe("CctvService media auth hook decision (Phase 4)", () => {
  let mockAuthz: AuthorizationService;
  let mockRepo: CctvRepositoryPort;
  let service: CctvService;

  const activeSession: CctvStreamSession = {
    id: "sess-1",
    cameraId: "cam-khordha-1",
    sessionId: "stream-001",
    status: "active",
    startedAt: "2026-02-11T00:00:00.000Z",
    endedAt: null,
    createdAt: "2026-02-11T00:00:00.000Z",
    mediaPath: "facility-vani/cam-gate",
    lastHeartbeatAt: "2026-02-11T00:00:30.000Z",
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    endedBy: null,
    endReason: null,
  };

  const TOKEN = "valid-playback-token";
  const tokenHashOf = (t: string): string => createHash("sha256").update(t).digest("hex");

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["district-khordha"])),
      canAccessDistrict: vi.fn((_ctx, distId) => distId === "district-khordha"),
    } as unknown as AuthorizationService;

    mockRepo = {
      findById: vi.fn().mockResolvedValue(mockCamera1),
      list: vi.fn(),
      createStreamSession: vi.fn(),
      endStreamSession: vi.fn(),
      touchHeartbeatBySessionId: vi.fn().mockResolvedValue(true),
      findActiveSessionByTokenHash: vi.fn().mockImplementation(async (hash: string) =>
        hash === tokenHashOf(TOKEN) ? activeSession : null,
      ),
      findActiveSessionBySessionId: vi.fn().mockResolvedValue(activeSession),
      countActiveByCamera: vi.fn().mockResolvedValue(1),
      findSweepCandidates: vi.fn().mockResolvedValue([]),
      endStreamSessionById: vi.fn().mockResolvedValue(true),
    };

    service = new CctvService(mockAuthz, mockRepo, "http://localhost:3003", "test-service-secret-at-least-32-chars");
  });

  it("allows read (WHEP/HLS live session) with a valid active session token on the session's own path", async () => {
    const decision = await service.mediaAuthDecision({
      token: TOKEN,
      action: "read",
      path: "facility-vani/cam-gate",
      protocol: "webrtc",
      ip: "127.0.0.1",
    });
    expect(decision).toEqual({
      allowed: true,
      mediaPath: "facility-vani/cam-gate",
      streamSessionId: "sess-1",
    });
  });

  it("resolves the HLS token from the query field (live-verified v1.21.1 behavior)", async () => {
    const decision = await service.mediaAuthDecision({
      token: "",
      query: `session=s1&token=${TOKEN}`,
      action: "read",
      path: "facility-vani/cam-gate",
      protocol: "hls",
      ip: "127.0.0.1",
    });
    expect(decision).toEqual({
      allowed: true,
      mediaPath: "facility-vani/cam-gate",
      streamSessionId: "sess-1",
    });
  });

  it("denies HLS with neither token field populated (fail-closed)", async () => {
    const decision = await service.mediaAuthDecision({
      token: "",
      query: "session=s1",
      action: "read",
      path: "facility-vani/cam-gate",
      protocol: "hls",
      ip: "127.0.0.1",
    });
    expect(decision).toEqual({ allowed: false, reason: "missing_playback_token" });
  });

  it("allows the playback action for forward-compatibility (recordings server)", async () => {
    const decision = await service.mediaAuthDecision({
      token: TOKEN,
      action: "playback",
      path: "facility-vani/cam-gate",
      protocol: "webrtc",
      ip: "127.0.0.1",
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies unknown tokens (fail-closed)", async () => {
    const decision = await service.mediaAuthDecision({
      token: "bogus-token",
      action: "playback",
      path: "facility-vani/cam-gate",
      protocol: "webrtc",
      ip: "127.0.0.1",
    });
    expect(decision).toEqual({ allowed: false, reason: "unknown_or_ended_session" });
  });

  it("denies a token used on a different media path (path binding)", async () => {
    const decision = await service.mediaAuthDecision({
      token: TOKEN,
      action: "playback",
      path: "facility-other/cam-2",
      protocol: "webrtc",
      ip: "127.0.0.1",
    });
    expect(decision).toEqual({ allowed: false, reason: "path_mismatch" });
  });

  it("denies an expired session token", async () => {
    (mockRepo.findActiveSessionByTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...activeSession,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const decision = await service.mediaAuthDecision({
      token: TOKEN,
      action: "playback",
      path: "facility-vani/cam-gate",
      protocol: "webrtc",
      ip: "127.0.0.1",
    });
    expect(decision).toEqual({ allowed: false, reason: "token_expired" });
  });

  it("denies publish and control-plane actions - the session token is consumer-only", async () => {
    for (const action of ["publish", "api", "metrics", "pprof"]) {
      const decision = await service.mediaAuthDecision({
        token: TOKEN,
        action,
        path: "facility-vani/cam-gate",
        protocol: "webrtc",
        ip: "127.0.0.1",
      });
      expect(decision).toEqual({ allowed: false, reason: `action_not_permitted:${action}` });
    }
  });

  it("denies protocols outside the browser-facing set", async () => {
    const decision = await service.mediaAuthDecision({
      token: TOKEN,
      action: "publish",
      path: "facility-vani/cam-gate",
      protocol: "rtsp",
      ip: "127.0.0.1",
    });
    expect(decision).toEqual({ allowed: false, reason: "action_not_permitted:publish" });
  });
});

describe("CctvService stream heartbeat and end (Phase 4)", () => {
  let mockAuthz: AuthorizationService;
  let mockRepo: CctvRepositoryPort;
  let service: CctvService;

  const activeSession: CctvStreamSession = {
    id: "sess-1",
    cameraId: "cam-khordha-1",
    sessionId: "stream-001",
    status: "active",
    startedAt: "2026-02-11T00:00:00.000Z",
    endedAt: null,
    createdAt: "2026-02-11T00:00:00.000Z",
    mediaPath: "facility-vani/cam-gate",
    lastHeartbeatAt: "2026-02-11T00:00:30.000Z",
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    endedBy: null,
    endReason: null,
  };

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["district-khordha"])),
      canAccessDistrict: vi.fn((_ctx, distId) => distId === "district-khordha"),
    } as unknown as AuthorizationService;

    mockRepo = {
      findById: vi.fn().mockResolvedValue(mockCamera1),
      list: vi.fn(),
      createStreamSession: vi.fn(),
      endStreamSession: vi.fn(),
      touchHeartbeatBySessionId: vi.fn().mockResolvedValue(true),
      findActiveSessionByTokenHash: vi.fn().mockResolvedValue(null),
      findActiveSessionBySessionId: vi.fn().mockResolvedValue(activeSession),
      countActiveByCamera: vi.fn().mockResolvedValue(1),
      findSweepCandidates: vi.fn().mockResolvedValue([]),
      endStreamSessionById: vi.fn().mockResolvedValue(true),
    };

    service = new CctvService(mockAuthz, mockRepo, "http://localhost:3003", "test-service-secret-at-least-32-chars");
  });

  it("heartbeat refreshes the session and returns the timestamp", async () => {
    const ctx = mockCtx();
    const result = await service.heartbeat(ctx, "cam-khordha-1", "stream-001");

    expect(result.lastHeartbeatAt).toEqual(expect.any(String));
    expect(mockRepo.touchHeartbeatBySessionId).toHaveBeenCalledWith("stream-001");
    // A heartbeat is NOT a state transition: no end event is written.
    expect(mockRepo.endStreamSession).not.toHaveBeenCalled();
  });

  it("heartbeat 404s when the session is already ended", async () => {
    (mockRepo.findActiveSessionBySessionId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = mockCtx();
    await expect(service.heartbeat(ctx, "cam-khordha-1", "stream-001")).rejects.toThrow(AppError);
  });

  it("heartbeat 404s when the session belongs to another camera", async () => {
    (mockRepo.findActiveSessionBySessionId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...activeSession,
      cameraId: "cam-cuttack-1",
    });
    const ctx = mockCtx();
    await expect(service.heartbeat(ctx, "cam-khordha-1", "stream-001")).rejects.toThrow(AppError);
  });

  it("viewer stop ends the session with viewer_stop attribution and ended event", async () => {
    const ctx = mockCtx();
    const result = await service.endStream(ctx, "cam-khordha-1", "stream-001", {
      endReason: "viewer_stop",
    });

    expect(result).toEqual({ ended: true, endReason: "viewer_stop" });
    expect(mockRepo.endStreamSession).toHaveBeenCalledWith(
      "stream-001",
      expect.objectContaining({
        auditAction: "cctv.stream_ended",
        eventType: "cctv.stream_ended",
        actorUserId: "user-officer-khordha",
      }),
      { endedBy: "viewer", endReason: "viewer_stop" },
    );
  });

  it("admin revoke writes the revoked audit action", async () => {
    const ctx = mockCtx();
    await service.endStream(ctx, "cam-khordha-1", "stream-001", { endReason: "admin_revoke" });

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "cctv:read");
    expect(mockRepo.endStreamSession).toHaveBeenCalledWith(
      "stream-001",
      expect.objectContaining({ auditAction: "cctv.stream_revoked" }),
      { endedBy: "viewer", endReason: "admin_revoke" },
    );
  });

  it("end 404s when the session is already ended (idempotent control path)", async () => {
    (mockRepo.findActiveSessionBySessionId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = mockCtx();
    await expect(
      service.endStream(ctx, "cam-khordha-1", "stream-001", { endReason: "viewer_stop" }),
    ).rejects.toThrow(AppError);
    expect(mockRepo.endStreamSession).not.toHaveBeenCalled();
  });
});
