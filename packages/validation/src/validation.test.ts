import { describe, expect, it } from "vitest";
import {
  devLoginSchema,
  realtimeAuthorizeSchema,
  paginationSchema,
  transitionProjectSchema,
  createProjectSchema,
  syncBatchRequestSchema,
  listCamerasQuerySchema,
  requestStreamSchema,
  publicCctvCameraSchema,
  cameraHealthStatusSchema,
  authorizedStreamSchema,
} from "./index.js";

describe("devLoginSchema", () => {
  it("accepts a valid email", () => {
    expect(devLoginSchema.safeParse({ email: "a@b.in" }).success).toBe(true);
  });
  it("rejects a bad email", () => {
    expect(devLoginSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
  it("rejects unknown keys (strict)", () => {
    expect(devLoginSchema.safeParse({ email: "a@b.in", token: "x" }).success).toBe(false);
  });
});

describe("realtimeAuthorizeSchema", () => {
  it("accepts a topic list", () => {
    expect(realtimeAuthorizeSchema.safeParse({ topics: ["project.*"] }).success).toBe(true);
  });
  it("rejects empty topics", () => {
    expect(realtimeAuthorizeSchema.safeParse({ topics: [] }).success).toBe(false);
  });
  it("rejects more than 50 topics", () => {
    expect(realtimeAuthorizeSchema.safeParse({ topics: Array(51).fill("a") }).success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("defaults page/pageSize", () => {
    expect(paginationSchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
  });
  it("rejects pageSize above the cap", () => {
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe("transitionProjectSchema", () => {
  it("accepts a valid status transition payload", () => {
    expect(transitionProjectSchema.safeParse({ to: "Active", note: "re-activated" }).success).toBe(
      true,
    );
  });
  it("rejects an unknown status", () => {
    expect(transitionProjectSchema.safeParse({ to: "Exploded" }).success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("accepts a minimal valid project", () => {
    expect(createProjectSchema.safeParse({ name: "Hostel X" }).success).toBe(true);
  });
  it("rejects empty name", () => {
    expect(createProjectSchema.safeParse({ name: "ab" }).success).toBe(false);
  });
});

describe("syncBatchRequestSchema", () => {
  const validOp = {
    operationId: "11111111-1111-4111-8111-111111111111",
    inspectionId: "22222222-2222-4222-8222-222222222222",
    type: "start_inspection",
    timestamp: "2026-03-01T06:00:00.000Z",
    payload: { note: "arrived on site" },
  };

  it("accepts a valid sync batch", () => {
    expect(syncBatchRequestSchema.safeParse({ operations: [validOp] }).success).toBe(true);
  });

  it("rejects invalid operation type", () => {
    const invalid = { ...validOp, type: "arbitrary_write" };
    expect(syncBatchRequestSchema.safeParse({ operations: [invalid] }).success).toBe(false);
  });

  it("rejects non-uuid operationId", () => {
    const invalid = { ...validOp, operationId: "not-a-uuid" };
    expect(syncBatchRequestSchema.safeParse({ operations: [invalid] }).success).toBe(false);
  });

  it("rejects non-datetime timestamp", () => {
    const invalid = { ...validOp, timestamp: "yesterday" };
    expect(syncBatchRequestSchema.safeParse({ operations: [invalid] }).success).toBe(false);
  });
});

describe("cctv schemas", () => {
  it("accepts valid list cameras query with defaults", () => {
    const parsed = listCamerasQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(20);
    }
  });

  it("accepts valid request stream input and defaults ttl", () => {
    const parsed = requestStreamSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ttlSeconds).toBe(300);
    }
  });

  it("rejects ttl outside limits", () => {
    expect(requestStreamSchema.safeParse({ ttlSeconds: 10 }).success).toBe(false);
    expect(requestStreamSchema.safeParse({ ttlSeconds: 5000 }).success).toBe(false);
  });

  it("validates public cctv camera omitting raw endpoint", () => {
    const valid = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Gate Camera",
      provider: "simulated",
      protocol: "rtsp",
      districtId: "22222222-2222-4222-8222-222222222222",
      status: "active",
      createdAt: "2026-02-11T00:00:00.000Z",
      updatedAt: "2026-02-11T00:00:00.000Z",
    };
    expect(publicCctvCameraSchema.safeParse(valid).success).toBe(true);
  });

  it("validates camera health status and authorized stream relay", () => {
    const health = {
      cameraId: "11111111-1111-4111-8111-111111111111",
      status: "online",
      latencyMs: 42,
      lastCheckedAt: "2026-02-11T00:00:00.000Z",
    };
    expect(cameraHealthStatusSchema.safeParse(health).success).toBe(true);

    const stream = {
      streamId: "stream-123",
      cameraId: "11111111-1111-4111-8111-111111111111",
      streamUrl: "http://localhost:3003/streams/stream-123?token=abc",
      expiresAt: "2026-02-11T00:05:00.000Z",
      token: "abc",
    };
    expect(authorizedStreamSchema.safeParse(stream).success).toBe(true);
  });
});
