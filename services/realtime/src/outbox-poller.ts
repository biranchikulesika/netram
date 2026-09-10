import type { OutboxRepository } from "@netram/data";
import type { Hub } from "./hub.js";

export class OutboxPoller {
  private running = false;
  private processing = false;

  constructor(
    private readonly repo: OutboxRepository,
    private readonly hub: Hub,
    private readonly intervalMs: number,
    private readonly batchSize: number,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      if (!this.processing) {
        this.processing = true;
        try {
          await this.tick();
        } catch (err) {
          console.error("[realtime] outbox poller tick failed:", err);
        } finally {
          this.processing = false;
        }
      }
      await new Promise((r) => setTimeout(r, this.intervalMs));
    }
  }

  private async tick(): Promise<void> {
    const pending = await this.repo.claimPending(this.batchSize);
    for (const record of pending) {
      try {
        const event = {
          id: record.id,
          type: record.type,
          occurredAt: record.occurredAt,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          payload: record.payload,
        };
        const delivered = this.hub.broadcast(event);
        await this.repo.markProcessed(record.id);
        if (delivered > 0) {
          console.log(`[realtime] delivered '${record.type}' to ${delivered} subscriber(s)`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.repo.markFailed(record.id, message);
      }
    }
  }
}
