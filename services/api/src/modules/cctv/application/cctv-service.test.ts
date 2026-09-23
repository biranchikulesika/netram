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
      } satisfies CctvStreamSession),
      endStreamSession: vi.fn().mockResolvedValue(undefined),
    };

    service = new CctvService(mockAuthz, mockRepo, "http://localhost:3003");
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
});
