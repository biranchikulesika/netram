import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { AttendanceExportJobQueuePort } from "../application/attendance-service.js";

const QUEUE_NAME = "netram-attendance-exports";

/**
 * Enqueues large attendance CSV export generation onto the BullMQ job system
 * (§39). jobId de-duplication makes re-enqueue idempotent per export.
 */
export class BullAttendanceExportJobQueue implements AttendanceExportJobQueuePort {
  private readonly queue: Queue<{ exportId: string }>;
  private readonly connection: Redis;

  constructor(redisUrl: string) {
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<{ exportId: string }>(QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueue(exportId: string): Promise<void> {
    await this.queue.add(
      "attendance.export.generate",
      { exportId },
      {
        jobId: exportId,
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
