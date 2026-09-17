import { describe, expect, it, vi, beforeEach } from "vitest";
import { VcService } from "./vc-service.js";
import type { VcSessionWithParticipants } from "@netram/types";
import type { VcRepositoryPort } from "./ports/vc-repository.js";
import type { VcProviderPort } from "./ports/vc-provider-port.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { AppError } from "../../../infrastructure/errors.js";
import { InvalidVcSessionTransitionError } from "../domain/vc-session.js";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-host-1",
    user: {
      id: "user-host-1",
      email: "host@dev.netram.in",
      displayName: "Host User",
      type: "netram",
    },
    permissions: new Set(["vc_session:read", "vc_session:create", "vc_session:manage"]),
    assignments: [],
    requestId: "req-vc-001",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

const mockSession1: VcSessionWithParticipants = {
  id: "session-1",
  title: "Site Progress Review",
  inspectionId: "insp-1",
  projectId: "proj-1",
  hostUserId: "user-host-1",
  roomName: "netram-review-01",
  provider: "webrtc",
  status: "scheduled",
  scheduledAt: "2026-03-10T10:00:00.000Z",
  startedAt: null,
  endedAt: null,
  metadata: {},
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  participants: [],
};

describe("VcService", () => {
  let mockAuthz: AuthorizationService;
  let mockRepo: VcRepositoryPort;
  let mockProvider: VcProviderPort;
  let service: VcService;

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
    } as unknown as AuthorizationService;

    mockRepo = {
      create: vi.fn().mockImplementation(async (data) => ({
        ...mockSession1,
        ...data,
      })),
      list: vi.fn().mockResolvedValue({
        items: [mockSession1],
        total: 1,
      }),
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "session-1") return { ...mockSession1 };
        return null;
      }),
      updateStatus: vi.fn().mockImplementation(async (id, status, fields) => ({
        ...mockSession1,
        id,
        status,
        ...fields,
      })),
      recordParticipantJoin: vi.fn().mockResolvedValue(undefined),
      recordParticipantLeave: vi.fn().mockResolvedValue(undefined),
    } as unknown as VcRepositoryPort;

    mockProvider = {
      createRoom: vi.fn().mockResolvedValue({ roomName: "netram-review-01" }),
      generateJoinDetails: vi.fn().mockResolvedValue({
        sessionId: "session-1",
        roomName: "netram-review-01",
        token: "jwt-join-token",
        provider: "webrtc",
        role: "host",
      }),
    };

    service = new VcService(mockAuthz, mockRepo, mockProvider);
  });

  it("creates a new VC session with audit and outbox event", async () => {
    const ctx = mockCtx();
    const session = await service.createSession(ctx, {
      title: "Site Progress Review",
      inspectionId: "insp-1",
      projectId: "proj-1",
    });

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "vc_session:create");
    expect(mockProvider.createRoom).toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Site Progress Review",
        hostUserId: ctx.user.id,
      }),
      expect.objectContaining({
        auditAction: "vc.session_created",
        eventType: "vc_session.created",
      }),
    );
    expect(session.title).toBe("Site Progress Review");
  });

  it("lists sessions with read permission", async () => {
    const ctx = mockCtx();
    const result = await service.listSessions(ctx);

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "vc_session:read");
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.id).toBe("session-1");
  });

  it("starts a scheduled session as host", async () => {
    const ctx = mockCtx();
    const session = await service.startSession(ctx, "session-1");

    expect(session.status).toBe("active");
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "session-1",
      "active",
      expect.objectContaining({ startedAt: expect.any(Date) }),
      expect.objectContaining({
        auditAction: "vc.session_started",
        eventType: "vc_session.started",
      }),
    );
  });

  it("rejects non-host and non-manager from starting session", async () => {
    const ctx = mockCtx({
      userId: "other-user",
      user: { id: "other-user", email: "other@dev.netram.in", displayName: "Other", type: "netram" },
      permissions: new Set(["vc_session:read"]),
    });

    await expect(service.startSession(ctx, "session-1")).rejects.toThrow(AppError);
  });

  it("joins a joinable session and returns join details", async () => {
    const ctx = mockCtx();
    const details = await service.joinSession(ctx, "session-1");

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "vc_session:read");
    expect(mockRepo.recordParticipantJoin).toHaveBeenCalledWith(
      "session-1",
      ctx.user.id,
      "host",
      expect.objectContaining({
        auditAction: "vc.participant_joined",
        eventType: "vc_session.participant_joined",
      }),
    );
    expect(details.token).toBe("jwt-join-token");
  });

  it("leaves a session and records audit/event", async () => {
    const ctx = mockCtx();
    await service.leaveSession(ctx, "session-1");

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "vc_session:read");
    expect(mockRepo.recordParticipantLeave).toHaveBeenCalledWith(
      "session-1",
      ctx.user.id,
      expect.objectContaining({
        auditAction: "vc.participant_left",
        eventType: "vc_session.participant_left",
      }),
    );
  });

  it("ends an active session", async () => {
    const ctx = mockCtx();
    vi.mocked(mockRepo.findById).mockResolvedValueOnce({
      ...mockSession1,
      status: "active",
    });

    const session = await service.endSession(ctx, "session-1");
    expect(session.status).toBe("completed");
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "session-1",
      "completed",
      expect.objectContaining({ endedAt: expect.any(Date) }),
      expect.objectContaining({
        auditAction: "vc.session_ended",
        eventType: "vc_session.ended",
      }),
    );
  });

  it("rejects ending a session with invalid state transition", async () => {
    const ctx = mockCtx();
    // mockSession1 is scheduled, cannot transition directly to completed
    await expect(service.endSession(ctx, "session-1")).rejects.toThrow(
      InvalidVcSessionTransitionError,
    );
  });
});
