import { describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { Hub } from "./hub.js";

function fakeSocket(onSend?: (msg: string) => void): WebSocket {
  return {
    readyState: 1,
    send: onSend ? vi.fn(onSend) : vi.fn(),
    on: vi.fn(),
  } as unknown as WebSocket;
}

describe("Realtime Hub & Resynchronization Protocol (RT-01, RT-04)", () => {
  it("broadcasts only to matching subscriptions", () => {
    const hub = new Hub();
    const matched = fakeSocket();
    const notMatched = fakeSocket();
    hub.subscribe({ socket: matched, allowedTopics: ["inspection.*"] });
    hub.subscribe({ socket: notMatched, allowedTopics: ["project.*"] });

    const sent = hub.broadcast({
      type: "inspection.submitted",
      id: "evt-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      resourceType: "inspection",
      resourceId: "inspection-1",
      payload: {},
    });

    expect(sent).toBe(1);
    expect(matched.send).toHaveBeenCalled();
    expect(notMatched.send).not.toHaveBeenCalled();
    expect(hub.size()).toBe(2);
  });

  it("replays missed buffered events to a reconnected client during resync (RT-04)", () => {
    const hub = new Hub(50);

    // Broadcast 3 events
    hub.broadcast({
      type: "inspection.assigned",
      id: "evt-101",
      occurredAt: "2026-01-01T00:00:00.000Z",
      resourceType: "inspection",
      resourceId: "insp-1",
      payload: {},
    });
    hub.broadcast({
      type: "inspection.submitted",
      id: "evt-102",
      occurredAt: "2026-01-01T00:01:00.000Z",
      resourceType: "inspection",
      resourceId: "insp-1",
      payload: {},
    });
    hub.broadcast({
      type: "evidence.uploaded",
      id: "evt-103",
      occurredAt: "2026-01-01T00:02:00.000Z",
      resourceType: "evidence",
      resourceId: "ev-1",
      payload: {},
    });

    const receivedMessages: string[] = [];
    const clientSocket = fakeSocket((msg) => receivedMessages.push(msg));
    const sub = { socket: clientSocket, allowedTopics: ["inspection.*"] };
    hub.subscribe(sub);

    // Client reconnects, knowing it last processed evt-101
    const replayed = hub.resync(sub, "evt-101");

    // Should replay evt-102 (matches inspection.*), but skip evt-103 (evidence.* doesn't match)
    expect(replayed).toBe(1);
    expect(receivedMessages.length).toBe(2); // 1 resync event + 1 resync_complete message
    expect(receivedMessages[0]).toContain("evt-102");
    expect(receivedMessages[1]).toContain("netram.resync_complete");
  });
});