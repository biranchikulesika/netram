import type { WebSocket } from "ws";

export interface Subscription {
  socket: WebSocket;
  allowedTopics: string[];
}

export interface RealtimeEventMessage {
  type: string;
  id: string;
  occurredAt: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
}

function matches(subscription: string, eventType: string): boolean {
  if (subscription === "*") return true;
  if (eventType === subscription) return true;
  if (subscription.endsWith(".*")) {
    const prefix = subscription.slice(0, -2);
    if (prefix === "") return true;
    return eventType.startsWith(`${prefix}.`);
  }
  return eventType.startsWith(`${subscription}.`);
}

/**
 * Realtime is delivery only — never authority (AGENTS.md §7, §28).
 *
 * The hub relays outbox events to sockets whose (API-authorized) subscriptions
 * match the event type. Maintains a ring buffer of recent events to support
 * immediate client resynchronization on reconnection (RT-04).
 */
export class Hub {
  private subscriptions = new Set<Subscription>();
  private readonly eventBuffer: RealtimeEventMessage[] = [];
  private readonly maxBufferSize: number;

  constructor(maxBufferSize = 100) {
    this.maxBufferSize = maxBufferSize;
  }

  subscribe(subscription: Subscription): void {
    this.subscriptions.add(subscription);
    subscription.socket.on("close", () => this.subscriptions.delete(subscription));

    // Handle incoming client messages (e.g. resync requests)
    subscription.socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { action?: string; lastEventId?: string };
        if (msg.action === "resync" && msg.lastEventId) {
          this.resync(subscription, msg.lastEventId);
        }
      } catch {
        // Ignore unparseable control messages
      }
    });
  }

  broadcast(event: RealtimeEventMessage): number {
    // Retain in ring buffer for reconnect resynchronization
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift();
    }

    let delivered = 0;
    for (const sub of this.subscriptions) {
      if (
        sub.socket.readyState === 1 /* OPEN */ &&
        sub.allowedTopics.some((t) => matches(t, event.type))
      ) {
        sub.socket.send(JSON.stringify({ event: "netram.event", data: event }));
        delivered += 1;
      }
    }
    return delivered;
  }

  /**
   * Replays missed buffered events to a reconnected client after lastEventId (§28, RT-04).
   */
  resync(subscription: Subscription, lastEventId: string): number {
    if (subscription.socket.readyState !== 1 /* OPEN */) return 0;

    const lastIdx = this.eventBuffer.findIndex((e) => e.id === lastEventId);
    const missed = lastIdx >= 0 ? this.eventBuffer.slice(lastIdx + 1) : this.eventBuffer;

    let replayed = 0;
    for (const event of missed) {
      if (subscription.allowedTopics.some((t) => matches(t, event.type))) {
        subscription.socket.send(
          JSON.stringify({ event: "netram.resync_event", data: event }),
        );
        replayed += 1;
      }
    }

    subscription.socket.send(
      JSON.stringify({
        event: "netram.resync_complete",
        data: { replayedCount: replayed, lastAvailableId: this.eventBuffer.at(-1)?.id ?? null },
      }),
    );

    return replayed;
  }

  size(): number {
    return this.subscriptions.size;
  }

  getBufferedCount(): number {
    return this.eventBuffer.length;
  }
}
