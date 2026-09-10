import { z } from "zod";

export const outboxEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  correlationId: z.string(),
  occurredAt: z.string().datetime(),
  actorUserId: z.string().uuid().nullable(),
  resourceType: z.string(),
  resourceId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["pending", "processed", "failed"]),
  attemptCount: z.number().int(),
  availableAfter: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  processedAt: z.string().datetime().nullable(),
});

export const outboxEventListSchema = z.array(outboxEventSchema);
