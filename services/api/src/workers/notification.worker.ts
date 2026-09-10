import { pathToFileURL } from "node:url";
import { Worker, Queue } from "bullmq";
import { Redis } from "ioredis";
import { getDb, NotificationRepository } from "@netram/data";
import { loadWorkerEnv } from "@netram/config";
import type { NotificationType } from "@netram/types";
import type { NotificationChannel } from "../modules/notifications/application/ports/notification-provider-port.js";
import { NotificationProviderRegistry } from "../modules/notifications/infrastructure/providers/notification-provider-registry.js";

export interface NotificationJobData {
  notificationId: string;
  userId: string;
  title: string;
  channel: NotificationChannel;
  type?: NotificationType;
  body?: string | null;
  /** Channel-specific recipient context (email address, phone, push token). */
  meta?: Record<string, unknown>;
}

export interface WorkerOptions {
  redisUrl: string;
  databaseUrl: string;
  concurrency?: number;
  /** smtp:// or smtps:// URL — enables the real SMTP email adapter. */
  smtpUrl?: string;
  /** "production" disables dev transports for push/SMS/email fallback. */
  nodeEnv?: string;
}

/**
 * Consumes `netram-notifications` jobs and delivers them through the
 * provider registry (AGENTS.md §41). Delivery is provider-agnostic: in-app
 * persists, email goes out over SMTP, push/SMS go through their adapters.
 */
export async function startNotificationWorker(
  opts: WorkerOptions,
): Promise<{ close: () => Promise<void> }> {
  const connection = new Redis(opts.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<NotificationJobData>("netram-notifications", {
    connection,
  });

  const db = getDb(opts.databaseUrl);
  const registry = new NotificationProviderRegistry({
    notificationRepo: new NotificationRepository(db),
    smtpUrl: opts.smtpUrl,
    nodeEnv: opts.nodeEnv,
  });

  const worker = new Worker<NotificationJobData>(
    "netram-notifications",
    async (job) => {
      const { notificationId, userId, title, body, channel, type, meta } = job.data;
      const result = await registry.send({
        notificationId,
        userId,
        title,
        body: body ?? null,
        channel,
        type: type ?? "inspection.assigned",
        meta,
      });
      job.log(
        `'${channel}' via ${result.provider}: ${result.delivered ? "delivered" : `not delivered (${result.reason ?? "unknown reason"})`} — ${title}`,
      );
      return result;
    },
    {
      connection,
      concurrency: opts.concurrency ?? 5,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} completed`);
  });

  return {
    close: async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}

export async function main(): Promise<void> {
  const env = loadWorkerEnv();
  console.log(`[worker] starting (redis=${env.REDIS_URL})`);
  const instance = await startNotificationWorker({
    redisUrl: env.REDIS_URL,
    databaseUrl: env.DATABASE_URL,
    smtpUrl: env.NETRAM_SMTP_URL,
    nodeEnv: env.NODE_ENV,
  });
  const shutdown = async () => {
    await instance.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

// Run standalone (`tsx src/workers/notification.worker.ts`) without
// self-starting when imported by run-workers.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}