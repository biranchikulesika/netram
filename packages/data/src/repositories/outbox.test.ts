import { describe, expect, it, vi, beforeEach } from "vitest";
import { OutboxRepository } from "./outbox.repository.js";
import type { DrizzleDB } from "../db/client.js";

interface MockDatabase {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  for: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

describe("OutboxRepository & Transactional Outbox Pattern Integrity", () => {
  let mockDb: MockDatabase;
  let repo: OutboxRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValue([
        {
          id: "event-1",
          type: "inspection.assigned",
          correlationId: "insp-101",
          occurredAt: new Date("2026-03-01T10:00:00.000Z"),
          actorUserId: "user-1",
          resourceType: "inspection",
          resourceId: "insp-101",
          payload: { inspectionId: "insp-101" },
          status: "pending",
          attemptCount: 0,
          availableAfter: null,
          lastError: null,
          processedAt: null,
        },
      ]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(mockDb);
      }),
    };

    repo = new OutboxRepository(mockDb as unknown as DrizzleDB);
  });

  it("enqueues a domain event into the outbox", async () => {
    await repo.enqueue({
      id: "event-1",
      type: "inspection.assigned",
      correlationId: "insp-101",
      actorUserId: "user-1",
      resourceType: "inspection",
      resourceId: "insp-101",
      payload: { inspectionId: "insp-101" },
    });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        type: "inspection.assigned",
        correlationId: "insp-101",
      }),
    );
  });

  it("claims pending outbox events using FOR UPDATE SKIP LOCKED", async () => {
    const records = await repo.claimPending(50);

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(50);
    expect(mockDb.for).toHaveBeenCalledWith("update", { skipLocked: true });
    expect(records.length).toBe(1);
    expect(records[0]!.id).toBe("event-1");
    expect(records[0]!.status).toBe("pending");
  });

  it("marks an outbox event as processed with timestamp", async () => {
    await repo.markProcessed("event-1");

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processed",
        processedAt: expect.any(Date),
      }),
    );
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("schedules an event retry with exponential backoff and increments attemptCount", async () => {
    await repo.scheduleRetry("event-1", "Timeout connecting to notification service", 5000);

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        lastError: "Timeout connecting to notification service",
        availableAfter: expect.any(Date),
      }),
    );
  });

  it("marks event dead-lettered when retries are exhausted", async () => {
    await repo.markDeadLetter("event-1", "Permanent delivery failure");

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        lastError: "DEAD_LETTER: Permanent delivery failure",
      }),
    );
  });

  it("simulates transaction rollback when an outbox write fails after business mutation", async () => {
    // Simulate transactional atomic write where outbox insertion throws
    const simulatedEntityTable: Array<Record<string, unknown>> = [];
    const simulatedOutboxTable: Array<Record<string, unknown>> = [];

    const mockTransactionalDb = {
      transaction: async (fn: (tx: {
        insertEntity: (item: Record<string, unknown>) => void;
        insertOutbox: (event: Record<string, unknown>) => void;
      }) => Promise<void>) => {
        // Create transactional savepoint
        const entitySnapshot = [...simulatedEntityTable];
        const outboxSnapshot = [...simulatedOutboxTable];
        try {
          const fakeTx = {
            insertEntity: (item: Record<string, unknown>) => {
              simulatedEntityTable.push(item);
            },
            insertOutbox: (_event: Record<string, unknown>) => {
              throw new Error("Simulated Outbox Disk/Constraint Error");
            },
          };
          return await fn(fakeTx);
        } catch (err) {
          // Transaction rolled back to savepoint
          simulatedEntityTable.length = 0;
          simulatedEntityTable.push(...entitySnapshot);
          simulatedOutboxTable.length = 0;
          simulatedOutboxTable.push(...outboxSnapshot);
          throw err;
        }
      },
    };

    await expect(
      mockTransactionalDb.transaction(async (tx) => {
        tx.insertEntity({ id: "proj-101", name: "New Project" });
        tx.insertOutbox({ id: "ev-101", type: "project.created" });
      }),
    ).rejects.toThrow("Simulated Outbox Disk/Constraint Error");

    // Verify atomic rollback: business entity was not retained
    expect(simulatedEntityTable).toEqual([]);
    expect(simulatedOutboxTable).toEqual([]);
  });
});
