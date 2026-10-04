import { pathToFileURL } from "node:url";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { getDb, AttendanceRepository } from "@netram/data";
import { loadWorkerEnv } from "@netram/config";
import { buildAttendanceCsv } from "../modules/attendance/application/attendance-service.js";

const QUEUE_NAME = "netram-attendance-exports";

export interface AttendanceExportJobData {
  exportId: string;
}

export interface AttendanceExportWorkerOptions {
  redisUrl: string;
  databaseUrl: string;
  concurrency?: number;
}

/**
 * Generates large attendance CSV exports in the background (§39): fetch rows
 * for the export scope, build CSV, store the artifact (retention window), and
 * record audit + outbox events. Idempotent per exportId; retried with backoff.
 */
export async function startAttendanceExportWorker(
  opts: AttendanceExportWorkerOptions,
): Promise<{ close: () => Promise<void> }> {
  const db = getDb(opts.databaseUrl);
  const repo = new AttendanceRepository(db);
  const connection = new Redis(opts.redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker<AttendanceExportJobData>(
    QUEUE_NAME,
    async (job: Job<AttendanceExportJobData>) => {
      const { exportId } = job.data;
      const record = await repo.findExportById(exportId);
      if (!record) throw new Error(`Attendance export not found: ${exportId}`);
      if (record.status === "READY" || record.status === "EXPIRED") {
        job.log(`attendance export ${exportId} already ${record.status}; skipping`);
        return { generated: false, reason: record.status };
      }

      // Regenerate rows from the authoritative calculation table for this scope.
      const scope = record.scope as {
        projectId?: string | null;
        districtId?: string | null;
        from?: string | null;
        to?: string | null;
      };
      const jurisdictionIds = scope.districtId ? [scope.districtId] : undefined;
      const rows = await repo.listAllCalculations({
        projectId: scope.projectId ?? undefined,
        jurisdictionIds,
        from: scope.from ?? undefined,
        to: scope.to ?? undefined,
      });
      const csv = buildAttendanceCsv(rows);
      await repo.generateExportArtifact({
        exportId,
        csv,
        recordCount: rows.length,
        actorUserId: record.requestedBy,
        requestId: null,
        ipAddress: null,
      });
      job.log(`attendance export ${exportId} generated (${rows.length} rows)`);
      return { generated: true, rows: rows.length };
    },
    { connection, concurrency: opts.concurrency ?? 2 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[attendance-export-worker] job ${job?.id} failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[attendance-export-worker] job ${job.id} completed`);
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
  console.log("[attendance-export-worker] starting");
  const instance = await startAttendanceExportWorker({
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
