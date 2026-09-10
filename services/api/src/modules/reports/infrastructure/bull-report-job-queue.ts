import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { ReportJobEnqueuerPort } from "../application/ports/report-repository.js";

const QUEUE_NAME = "netram-reports";

/**
 * Enqueues report generation onto the BullMQ-backed job system (§29).
 * jobId de-duplication makes re-enqueue idempotent per report.
 */
export class BullReportJobQueue implements ReportJobEnqueuerPort {
  private readonly queue: Queue<{ reportId: string }>;
  private readonly connection: Redis;

  constructor(redisUrl: string) {
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<{ reportId: string }>(QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueue(reportId: string): Promise<void> {
    await this.queue.add(
      "report.generate",
      { reportId },
      {
        jobId: reportId,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 10,
      },
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
