import { loadWorkerEnv } from "@netram/config";
import { startNotificationWorker } from "./notification.worker.js";
import { startReportWorker } from "./report.worker.js";
import { startOutboxDispatcherWorker } from "./outbox-dispatcher.worker.js";
import { startScheduledJobsWorker } from "./scheduled-jobs.worker.js";

export async function main(): Promise<void> {
  const env = loadWorkerEnv();
  console.log("==================================================================");
  console.log("🚀 Starting Netram Background Worker Pool");
  console.log(`   Redis:    ${env.REDIS_URL}`);
  console.log(`   Database: ${env.DATABASE_URL.replace(/:\/\/.*@/, "://***@")}`);
  console.log("==================================================================");

  const closers: Array<() => Promise<void>> = [];

  try {
    // 1. Notification Worker (BullMQ: netram-notifications)
    console.log("[workers] Initializing Notification Worker...");
    const notifWorker = await startNotificationWorker({
      redisUrl: env.REDIS_URL,
      databaseUrl: env.DATABASE_URL,
      smtpUrl: env.NETRAM_SMTP_URL,
      nodeEnv: env.NODE_ENV,
    });
    closers.push(notifWorker.close);
    console.log("✓ Notification Worker online");

    // 2. Report Generation Worker (BullMQ: netram-reports)
    console.log("[workers] Initializing Report Generation Worker...");
    const reportWorker = await startReportWorker({
      redisUrl: env.REDIS_URL,
      databaseUrl: env.DATABASE_URL,
    });
    closers.push(reportWorker.close);
    console.log("✓ Report Generation Worker online");

    // 3. Durable Outbox Dispatcher (Polls DB -> BullMQ with exponential backoff)
    console.log("[workers] Initializing Durable Outbox Dispatcher...");
    const outboxDispatcher = await startOutboxDispatcherWorker({
      redisUrl: env.REDIS_URL,
      databaseUrl: env.DATABASE_URL,
      pollIntervalMs: 1000,
    });
    closers.push(outboxDispatcher.close);
    console.log("✓ Outbox Dispatcher online");

    // 4. Scheduled Jobs Runner (SLA evaluation & maintenance)
    console.log("[workers] Initializing Scheduled Jobs Runner...");
    const scheduledJobs = await startScheduledJobsWorker({
      databaseUrl: env.DATABASE_URL,
      intervalMs: 5000,
    });
    closers.push(scheduledJobs.close);
    console.log("✓ Scheduled Jobs Runner online");

    console.log("\n⚡ Netram Worker Pool successfully running with all 4 workers active.");

    const shutdown = async (signal: string) => {
      console.log(`\n[workers] Received ${signal}. Gracefully stopping worker pool...`);
      for (const close of closers) {
        try {
          await close();
        } catch (err) {
          console.error("[workers] Error during shutdown:", err);
        }
      }
      console.log("[workers] All workers shut down cleanly.");
      process.exit(0);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Failed to start worker pool:", err);
    process.exit(1);
  }
}

void main();
