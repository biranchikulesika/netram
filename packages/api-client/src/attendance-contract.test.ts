import { describe, expect, it, vi } from "vitest";
import { NetramApiClient } from "./index.js";

function makeClient(fetchImpl: typeof fetch): NetramApiClient {
  return new NetramApiClient({ baseUrl: "http://test", fetchImpl });
}

/**
 * Regression tests for tenant-contract correctness of the attendance calls.
 * These assert the exact HTTP request (path + method + query) the client
 * issues, so an accidental URL/method change breaks the test immediately.
 */
describe("NetramApiClient attendance contract", () => {
  it("reviewAttendanceAnomaly interpolates the real ID into the request path", async () => {
    const fetchImpl = vi.fn(async (_input: unknown) => {
      const response = new Response(
        JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
      return response;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await client.reviewAttendanceAnomaly("b8e3a4d6-6a1e-4ef1-9f1b-2c1d3e4f5a6b", {
      action: "acknowledge",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as [unknown];
    expect(String(url)).toBe(
      "http://test/api/v1/attendance/anomalies/b8e3a4d6-6a1e-4ef1-9f1b-2c1d3e4f5a6b/review",
    );
  });

  it("drillDownIndividualAttendance issues a GET with query parameters", async () => {
    const fetchImpl = vi.fn(async (_input: unknown) => {
      const response = new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      return response;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await client.drillDownIndividualAttendance({
      projectId: "proj-1",
      personExternalId: "EXT-42",
      operationalDate: "2026-01-01",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { method?: string }];
    expect(url).toBe(
      "http://test/api/v1/attendance/individual?projectId=proj-1&personExternalId=EXT-42&operationalDate=2026-01-01",
    );
    expect(init?.method).toBe("GET");
  });

  it("drillDownIndividualAttendance does not pass empty optional params", async () => {
    const fetchImpl = vi.fn(async (_input: unknown) => {
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await client.drillDownIndividualAttendance({ projectId: "proj-1", personExternalId: "EXT-42" });

    const [url] = fetchImpl.mock.calls[0] as [unknown];
    expect(String(url)).toBe(
      "http://test/api/v1/attendance/individual?projectId=proj-1&personExternalId=EXT-42",
    );
  });
});
