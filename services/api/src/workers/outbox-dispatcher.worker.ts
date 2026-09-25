import { pathToFileURL } from "node:url";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getDb, OutboxRepository } from "@netram/data";
import { loadWorkerEnv } from "@netram/config";
import type { OutboxRecord, NotificationType } from "@netram/types";
import type { NotificationJobData } from "./notification.worker.js";

export interface OutboxDispatcherOptions {
  redisUrl: string;
  databaseUrl: string;
  pollIntervalMs?: number;
  batchSize?: number;
  maxRetries?: number;
}

export const DISPATCHER_HANDLED_EVENT_TYPES = [
  "inspection.assigned",
  "corrective_action.overdue",
  "ai.anomaly_detected",
] as const;

export class OutboxDispatcher {
  private running = false;
  private processing = false;
  private readonly notificationQueue: Queue<NotificationJobData>;
  private readonly redisConnection: Redis;
  private readonly maxRetries: number;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly outboxRepo: OutboxRepository,
    opts: OutboxDispatcherOptions,
  ) {
    this.redisConnection = new Redis(opts.redisUrl, { maxRetriesPerRequest: null });
    this.notificationQueue = new Queue<NotificationJobData>("netram-notifications", {
      connection: this.redisConnection,
    });
    this.maxRetries = opts.maxRetries ?? 5;
    this.pollIntervalMs = opts.pollIntervalMs ?? 1000;
    this.batchSize = opts.batchSize ?? 50;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  async close(): Promise<void> {
    this.stop();
    await this.notificationQueue.close();
    await this.redisConnection.quit();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      if (!this.processing) {
        this.processing = true;
        try {
          await this.tick();
        } catch (err) {
          console.error("[outbox-dispatcher] tick error:", err);
        } finally {
          this.processing = false;
        }
      }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }

  /**
   * Processes a single tick of the outbox loop.
   * Can be called directly in integration tests or workers.
   */
  async tick(): Promise<{ claimed: number; processed: number; retried: number; deadLettered: number }> {
    const records = await this.outboxRepo.claimPending(this.batchSize, DISPATCHER_HANDLED_EVENT_TYPES);
    let processed = 0;
    let retried = 0;
    let deadLettered = 0;

    for (const record of records) {
      try {
        await this.dispatchEvent(record);
        await this.outboxRepo.markProcessed(record.id);
        processed++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (record.attemptCount + 1 >= this.maxRetries) {
          console.error(
            `[outbox-dispatcher] Event ${record.id} exhausted ${this.maxRetries} attempts. Moving to dead-letter:`,
            errMsg,
          );
          await this.outboxRepo.markDeadLetter(record.id, errMsg);
          deadLettered++;
        } else {
          // Exponential backoff: min(1000 * 2^attempt, 60000ms)
          const backoffMs = Math.min(1000 * Math.pow(2, record.attemptCount), 60000);
          console.warn(
            `[outbox-dispatcher] Event ${record.id} failed (attempt ${record.attemptCount + 1}/${this.maxRetries}). Retrying in ${backoffMs}ms:`,
            errMsg,
          );
          await this.outboxRepo.scheduleRetry(record.id, errMsg, backoffMs);
          retried++;
        }
      }
    }

    return { claimed: records.length, processed, retried, deadLettered };
  }

  /**
   * Translates a durable domain event into targeted asynchronous background jobs (§27, §29).
   */
  private async dispatchEvent(record: OutboxRecord): Promise<void> {
    switch (record.type) {
      case "inspection.assigned": {
        const payload = record.payload as { assignedUserIds?: string[]; inspectionId?: string };
        const userIds = payload.assignedUserIds ?? (record.actorUserId ? [record.actorUserId] : []);
        for (const uid of userIds) {
          await this.notificationQueue.add(
            "notification.send",
            {
              notificationId: `notif-insp-assign-${record.id}-${uid}`,
              userId: uid,
              title: "New Inspection Assigned",
              channel: "in_app",
              type: "inspection.assigned" satisfies NotificationType,
            },
            {
              jobId: `notif-insp-assign-${record.id}-${uid}`,
              attempts: 3,
              removeOnComplete: { count: 500 },
              removeOnFail: { count: 1000 },
            },
          );
        }
        break;
      }

      case "corrective_action.overdue": {
        const payload = record.payload as { correctiveActionId?: string; findingId?: string };
        await this.notificationQueue.add(
          "notification.send",
          {
            notificationId: `notif-ca-overdue-${record.id}`,
            userId: record.actorUserId ?? "00000000-0000-0000-0000-000000000000",
            title: `URGENT: Corrective Action Overdue (${payload.correctiveActionId ?? record.resourceId})`,
            channel: "in_app",
            type: "corrective_action.overdue" satisfies NotificationType,
          },
          {
            jobId: `notif-ca-overdue-${record.id}`,
            priority: 1, // High priority in BullMQ
            attempts: 3,
            removeOnComplete: { count: 500 },
            removeOnFail: { count: 1000 },
          },
        );
        break;
      }

      case "ai.anomaly_detected": {
        const payload = record.payload as { anomalyId?: string; description?: string };
        await this.notificationQueue.add(
          "notification.send",
          {
            notificationId: `notif-ai-anomaly-${record.id}`,
            userId: "00000000-0000-0000-0000-000000000000",
            title: `Advisory Anomaly Detected: ${payload.description ?? "Inspection anomaly flagged for review"}`,
            channel: "in_app",
            type: "ai.anomaly_detected" satisfies NotificationType,
          },
          {
            jobId: `notif-ai-anomaly-${record.id}`,
            attempts: 3,
            removeOnComplete: { count: 500 },
            removeOnFail: { count: 1000 },
          },
        );
        break;
      }

      default:
        // Other events (e.g. project transitions, observations, evidence capture)
        // are preserved in durable outbox for audit and realtime subscribers.
        break;
    }
  }
}

export async function startOutboxDispatcherWorker(
  opts: OutboxDispatcherOptions,
): Promise<{ close: () => Promise<void>; dispatcher: OutboxDispatcher }> {
  const db = getDb(opts.databaseUrl);
  const outboxRepo = new OutboxRepository(db);
  const dispatcher = new OutboxDispatcher(outboxRepo, opts);
  dispatcher.start();
  return {
    dispatcher,
    close: async () => {
      await dispatcher.close();
    },
  };
}

export async function main(): Promise<void> {
  const env = loadWorkerEnv();
  console.log(`[outbox-dispatcher] starting (redis=${env.REDIS_URL})`);
  const instance = await startOutboxDispatcherWorker({
    redisUrl: env.REDIS_URL,
    databaseUrl: env.DATABASE_URL,
  });
  const shutdown = async () => {
    await instance.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

// Run standalone without self-starting when imported by run-workers.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
