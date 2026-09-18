import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildApp } from "./app.js";
import type { Container } from "./infrastructure/container.js";
import { InvalidTransitionError } from "./modules/projects/domain/project.js";
import { AppError } from "./infrastructure/errors.js";

describe("Fastify Standard Error Envelope Compliance (§18)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    const mockContainer = {
      config: {
        LOG_LEVEL: "silent",
        NETRAM_CORS_ORIGIN: "*",
      },
      authService: {
        authenticate: vi.fn().mockResolvedValue({
          userId: "test-user-1",
          user: {
            id: "test-user-1",
            email: "test@dev.netram.in",
            displayName: "Test User",
            type: "netram",
          },
          assignments: [],
          permissions: new Set(["*"]),
        }),
      },
      auditRepo: {
        append: vi.fn().mockResolvedValue(undefined),
      },
      healthService: {
        check: vi.fn().mockResolvedValue({ status: "healthy" }),
      },
      projectService: {},
      inspectionService: {},
      findingService: {},
      correctiveActionService: {},
      observationService: {},
      evidenceService: {},
      complaintService: {},
      auditService: {},
      aiAnomalyService: {},
      inspectionAssignmentService: {},
      notificationService: {},
      reportService: {},
      userAdminService: {},
      realtimeAuthorizeService: {},
      cctvService: {},
      vcService: {},
      attendanceService: {},
      inspectionSyncService: {},
    } as unknown as Container;

    app = await buildApp(mockContainer);

    // Register synthetic test routes to explicitly test each error branch
    app.get("/test/custom-app-error", { config: { public: true } }, async () => {
      throw AppError.badRequest("Custom bad request error", { field: "name" });
    });

    app.get("/test/invalid-transition", { config: { public: true } }, async () => {
      throw new InvalidTransitionError("Draft", "Closed");
    });

    app.get("/test/unhandled-crash", { config: { public: true } }, async () => {
      throw new Error("Simulated critical unhandled exception");
    });

    await app.ready();
  });

  it("formats 401 Unauthorized into standard error envelope when token missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { "x-request-id": "req-auth-test-401" },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
        requestId: "req-auth-test-401",
        details: null,
      },
    });
  });

  it("formats 404 Route Not Found into standard error envelope", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/non-existent-api-endpoint",
      headers: {
        authorization: "Bearer valid-token",
        "x-request-id": "req-custom-id-404",
      },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: expect.stringContaining("Route GET:/non-existent-api-endpoint not found"),
        requestId: "req-custom-id-404",
      },
    });
    expect(response.headers["x-request-id"]).toBe("req-custom-id-404");
  });

  it("formats AppError into standard error envelope with details and custom code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/custom-app-error",
      headers: { "x-request-id": "req-custom-id-app-err" },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Custom bad request error",
        requestId: "req-custom-id-app-err",
        details: { field: "name" },
      },
    });
  });

  it("formats InvalidStateTransition errors into 409 INVALID_STATE_TRANSITION envelope", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/invalid-transition",
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error.code).toBe("INVALID_STATE_TRANSITION");
    expect(body.error.message).toContain("Draft -> Closed");
    expect(body.error.requestId).toBeDefined();
  });

  it("formats unhandled exceptions into 500 INTERNAL_ERROR without leaking stack trace (§18)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/unhandled-crash",
      headers: { "x-request-id": "req-crash-safe-id" },
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
        requestId: "req-crash-safe-id",
      },
    });
    // Ensure no stack trace is leaked
    expect((body as Record<string, unknown>).stack).toBeUndefined();
    expect(body.error.message).not.toContain("Simulated critical unhandled exception");
  });
});
