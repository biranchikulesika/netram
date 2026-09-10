import { pathToFileURL } from "node:url";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { getDb, ReportRepository } from "@netram/data";
import { loadWorkerEnv } from "@netram/config";
import { buildReportArtifact } from "../modules/reports/application/report-builder.js";

const QUEUE_NAME = "netram-reports";

export interface ReportJobData {
  reportId: string;
}

export interface ReportWorkerOptions {
  redisUrl: string;
  databaseUrl: string;
  concurrency?: number;
}

/**
 * Generates derived inspection reports (§34) from authoritative structured
 * records. Status machine: requested -> generating -> ready|failed ; failed is
 * retried by BullMQ with backoff. ready/finalized jobs are treated as no-ops.
 */
export async function startReportWorker(
  opts: ReportWorkerOptions,
): Promise<{ close: () => Promise<void> }> {
  const db = getDb(opts.databaseUrl);
  const repo = new ReportRepository(db);
  const connection = new Redis(opts.redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker<ReportJobData>(
    QUEUE_NAME,
    async (job: Job<ReportJobData>) => {
      const { reportId } = job.data;
      const report = await repo.findById(reportId);
      if (!report) throw new Error(`Report not found: ${reportId}`);
      if (report.status === "ready" || report.status === "finalized") {
        job.log(`report ${reportId} already ${report.status}; skipping`);
        return { generated: false, reason: report.status };
      }

      try {
        await repo.markGenerating(reportId);
        const snapshot = await repo.loadSnapshot(report.inspectionId);
        const artifact = buildReportArtifact(snapshot);
        const updated = await repo.generateWithArtifact({
          reportId,
          generatedBy: null,
          actorUserId: null,
          requestId: null,
          ipAddress: null,
          artifact,
          eventType: "report.generated",
        });
        job.log(
          `report ${reportId} generated (${snapshot.findings.length} findings, ${snapshot.evidence.length} evidence)`,
        );
        return { generated: true, status: updated.status };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await repo.markFailed({
          reportId,
          errorMessage: message,
          actorUserId: null,
          requestId: null,
          ipAddress: null,
        });
        throw err;
      }
    },
    { connection, concurrency: opts.concurrency ?? 5 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[report-worker] job ${job?.id} failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[report-worker] job ${job.id} completed`);
  });

  return {
    close: async () => {
      await worker.close();
      await connection.quit();
    },
  };
}

export async function main(): Promise<void> {
  const env = loadWorkerEnv();
  console.log(`[report-worker] starting (redis=${env.REDIS_URL})`);
  const instance = await startReportWorker({
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

// Run standalone (`tsx src/workers/report.worker.ts`) without self-starting
// when imported by run-workers.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
