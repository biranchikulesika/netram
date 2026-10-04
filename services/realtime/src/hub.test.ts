import { describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { Hub } from "../src/hub.js";

function fakeSocket(): WebSocket {
  return { readyState: 1, send: () => {}, on: () => {} } as unknown as WebSocket;
}

describe("Hub", () => {
  it("broadcasts only to matching subscriptions", () => {
    const hub = new Hub();
    const matched = fakeSocket();
    const notMatched = fakeSocket();
    hub.subscribe({ socket: matched, allowedTopics: ["InspectionSubmitted"] });
    hub.subscribe({ socket: notMatched, allowedTopics: ["ProjectSuspended"] });

    const sent = hub.broadcast({
      type: "InspectionSubmitted",
      id: "evt-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      resourceType: "inspection",
      resourceId: "inspection-1",
      payload: {},
    });

    expect(sent).toBe(1);
    expect(hub.size()).toBe(2);
  });
});
