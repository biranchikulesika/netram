import { describe, expect, it, vi } from "vitest";
import { ApiError, HttpClient } from "./http.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function client(fetchImpl: typeof fetch, onUnauthorized?: () => void) {
  return new HttpClient({
    baseUrl: "https://api.test",
    fetchImpl,
    getToken: () => "token-abc",
    onUnauthorized,
  });
}

describe("HttpClient authorization failures", () => {
  it("reports an expired session to the host when the server returns 401", async () => {
    // An expired token must never be indistinguishable from "no data": a caller
    // that swallows a 401 renders an empty list for a signed-in user.
    const onUnauthorized = vi.fn();
    const c = client(async () => jsonResponse(401, {
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
    }), onUnauthorized);

    await expect(c.get("/api/v1/inspections")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("preserves the server error contract on the thrown error", async () => {
    const c = client(async () => jsonResponse(401, {
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token.", requestId: "req-1" },
    }));

    await expect(c.get("/api/v1/inspections")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired token.",
      requestId: "req-1",
    });
  });

  it("does not signal the host for non-auth failures", async () => {
    const onUnauthorized = vi.fn();
    const c = client(async () => jsonResponse(403, {
      error: { code: "FORBIDDEN", message: "Out of jurisdiction." },
    }), onUnauthorized);

    await expect(c.get("/api/v1/inspections")).rejects.toMatchObject({ status: 403 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("still throws the 401 when the host handler itself fails", async () => {
    const c = client(async () => jsonResponse(401, {
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
    }), () => {
      throw new Error("handler exploded");
    });

    await expect(c.get("/api/v1/inspections")).rejects.toMatchObject({ status: 401 });
  });

  it("signals the host on a 401 returned from a binary download", async () => {
    const onUnauthorized = vi.fn();
    const c = client(async () => jsonResponse(401, {
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
    }), onUnauthorized);

    await expect(c.getBlob("/api/v1/evidence/1/content")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("works when no host handler is configured", async () => {
    const c = client(async () => jsonResponse(401, {
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
    }));

    await expect(c.get("/api/v1/inspections")).rejects.toBeInstanceOf(ApiError);
  });
});