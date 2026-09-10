import type { DomainEventType, UUID } from "@netram/types";

export interface OutboxEnqueue {
  id?: UUID;
  type: DomainEventType;
  correlationId: string;
  actorUserId: string | null;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  availableAfter?: Date | null;
}

/**
 * Durable outbox. Application state mutations and event publication intent
 * must not silently diverge.
 */
export interface OutboxRepositoryPort {
  enqueue(event: OutboxEnqueue): Promise<void>;
}
