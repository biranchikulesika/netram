import type { WebSocket } from "ws";

export interface Subscription {
  socket: WebSocket;
  allowedTopics: string[];
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
 * Realtime is delivery only - never authority. The hub relays outbox events
 * to sockets whose (API-authorized) subscriptions match the event type.
 * Payloads are the minimal outbox payload; clients fetch authoritative state
 * through the REST API after receiving a notification.
 */
export class Hub {
  private subscriptions = new Set<Subscription>();

  subscribe(subscription: Subscription): void {
    this.subscriptions.add(subscription);
    subscription.socket.on("close", () => this.subscriptions.delete(subscription));
  }

  broadcast(event: {
    type: string;
    id: string;
    occurredAt: string;
    resourceType: string;
    resourceId: string;
    payload: Record<string, unknown>;
  }): number {
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

  size(): number {
    return this.subscriptions.size;
  }
}
